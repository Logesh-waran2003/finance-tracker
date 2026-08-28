import { db } from '@/lib/db'
import { collections, dues, customers, attendance, reconciliations, profiles, expenses, notifications } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql, notInArray, isNull, desc } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET() {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  // Build an optional branch filter for each query
  const branchFilter = actor.branch_id ? actor.branch_id : null

  const [
    dbNotifications,
    pendingCollections,
    overdueCount,
    allAgents,
    presentToday,
    pendingReconciliation,
    pendingExpenseCount,
  ] = await Promise.all([
    db.select()
      .from(notifications)
      .where(and(eq(notifications.recipient_id, actor.id), eq(notifications.is_read, false)))
      .orderBy(desc(notifications.created_at))
      .limit(20),
    db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    }).from(collections).where(
      branchFilter
        ? and(eq(collections.status, 'PENDING'), eq(collections.branch_id, branchFilter))
        : eq(collections.status, 'PENDING')
    ).then(r => r[0]),

    db.select({ count: sql<number>`count(*)::int` })
      .from(dues)
      .leftJoin(customers, eq(dues.customer_id, customers.id))
      .where(and(
        notInArray(dues.status, ['PAID', 'CANCELLED']),
        isNull(dues.deleted_at),
        sql`${dues.due_date} < ${today}`,
        // Branch isolation — filter via the customer's branch_id
        ...(branchFilter ? [eq(customers.branch_id, branchFilter)] : []),
      )).then(r => r[0]?.count ?? 0),

    db.select({ id: profiles.id, full_name: profiles.full_name })
      .from(profiles)
      .where(
        branchFilter
          ? and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true), eq(profiles.branch_id, branchFilter))
          : and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true))
      ),

    db.select({ eid: attendance.employee_id })
      .from(attendance).where(
        branchFilter
          ? and(eq(attendance.date, today), eq(attendance.branch_id, branchFilter))
          : eq(attendance.date, today)
      ),

    db.select({ count: sql<number>`count(*)::int` })
      .from(reconciliations)
      .where(
        branchFilter
          ? and(eq(reconciliations.status, 'SUBMITTED'), eq(reconciliations.branch_id, branchFilter))
          : eq(reconciliations.status, 'SUBMITTED')
      ).then(r => r[0]?.count ?? 0),

    db.select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(
        branchFilter
          ? and(eq(expenses.status, 'PENDING'), eq(expenses.branch_id, branchFilter))
          : eq(expenses.status, 'PENDING')
      )
      .then(r => r[0]?.count ?? 0),
  ])

  const presentIds = new Set(presentToday.map(r => r.eid))
  const absentToday = allAgents.filter(a => !presentIds.has(a.id))

  // Map individual DB notifications (prepended before aggregate alerts)
  const individual = dbNotifications.map(row => ({
    id: row.id,
    type: 'info' as const,
    title: row.title,
    message: row.body,
    href: row.reference_type === 'loan_request' ? '/admin/loan-requests' : '/admin/collections',
    dbNotification: true as const,
  }))

  const alerts: { id?: string; type: string; title: string; message: string; href: string; dbNotification?: boolean }[] = []

  if ((pendingCollections?.count ?? 0) > 0) {
    alerts.push({
      type: 'warning',
      title: 'Pending Collections',
      message: `${pendingCollections?.count} collection${(pendingCollections?.count ?? 0) !== 1 ? 's' : ''} pending confirmation — ₹${parseFloat(pendingCollections?.total ?? '0').toLocaleString('en-IN')} total`,
      href: '/admin/collections',
    })
  }

  if (overdueCount > 0) {
    alerts.push({
      type: 'error',
      title: 'Overdue Dues',
      message: `${overdueCount} due${overdueCount !== 1 ? 's are' : ' is'} past their due date`,
      href: '/admin/customers',
    })
  }

  if (absentToday.length > 0) {
    alerts.push({
      type: 'info',
      title: 'Agents Not Checked In',
      message: `${absentToday.length} agent${absentToday.length !== 1 ? 's have' : ' has'} not checked in today: ${absentToday.map(a => a.full_name).slice(0, 3).join(', ')}${absentToday.length > 3 ? ` +${absentToday.length - 3} more` : ''}`,
      href: '/admin/attendance',
    })
  }

  if (pendingReconciliation > 0) {
    alerts.push({
      type: 'warning',
      title: 'Cash Reconciliation',
      message: `${pendingReconciliation} submission${pendingReconciliation !== 1 ? 's' : ''} waiting for verification`,
      href: '/admin/reconciliation',
    })
  }

  if (pendingExpenseCount > 0) {
    alerts.push({
      type: 'info',
      title: 'Expense Claims',
      message: `${pendingExpenseCount} expense claim${pendingExpenseCount !== 1 ? 's' : ''} pending approval`,
      href: '/admin/expenses',
    })
  }

  const combined = [...individual, ...alerts]
  return NextResponse.json({ notifications: combined, count: combined.length })
}

export async function PATCH(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db
    .update(notifications)
    .set({ is_read: true })
    .where(eq(notifications.id, id))

  return NextResponse.json({ ok: true })
}
