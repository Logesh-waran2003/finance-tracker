import { auth } from '@/auth'
import { db } from '@/lib/db'
import { collections, dues, attendance, reconciliations, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql, notInArray } from 'drizzle-orm'
import { expenses } from '@/lib/db/schema'
import type { Session } from 'next-auth'

export async function GET() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  const [
    pendingCollections,
    overdueCount,
    allAgents,
    presentToday,
    pendingReconciliation,
    pendingExpenseCount,
  ] = await Promise.all([
    db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    }).from(collections).where(eq(collections.status, 'PENDING')).then(r => r[0]),

    db.select({ count: sql<number>`count(*)::int` })
      .from(dues)
      .where(and(
        notInArray(dues.status, ['PAID', 'CANCELLED']),
        sql`${dues.due_date} < ${today}`,
      )).then(r => r[0]?.count ?? 0),

    db.select({ id: profiles.id, full_name: profiles.full_name })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true))),

    db.select({ eid: attendance.employee_id })
      .from(attendance).where(eq(attendance.date, today)),

    db.select({ count: sql<number>`count(*)::int` })
      .from(reconciliations)
      .where(eq(reconciliations.status, 'SUBMITTED')).then(r => r[0]?.count ?? 0),

    db.select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(eq(expenses.status, 'PENDING'))
      .then(r => r[0]?.count ?? 0),
  ])

  const presentIds = new Set(presentToday.map(r => r.eid))
  const absentToday = allAgents.filter(a => !presentIds.has(a.id))

  const notifications: { type: string; title: string; message: string; href: string }[] = []

  if ((pendingCollections?.count ?? 0) > 0) {
    notifications.push({
      type: 'warning',
      title: 'Pending Collections',
      message: `${pendingCollections?.count} collection${(pendingCollections?.count ?? 0) !== 1 ? 's' : ''} pending confirmation — ₹${parseFloat(pendingCollections?.total ?? '0').toLocaleString('en-IN')} total`,
      href: '/admin/collections',
    })
  }

  if (overdueCount > 0) {
    notifications.push({
      type: 'error',
      title: 'Overdue Dues',
      message: `${overdueCount} due${overdueCount !== 1 ? 's are' : ' is'} past their due date`,
      href: '/admin/customers',
    })
  }

  if (absentToday.length > 0) {
    notifications.push({
      type: 'info',
      title: 'Agents Not Checked In',
      message: `${absentToday.length} agent${absentToday.length !== 1 ? 's have' : ' has'} not checked in today: ${absentToday.map(a => a.full_name).slice(0, 3).join(', ')}${absentToday.length > 3 ? ` +${absentToday.length - 3} more` : ''}`,
      href: '/admin/attendance',
    })
  }

  if (pendingReconciliation > 0) {
    notifications.push({
      type: 'warning',
      title: 'Cash Reconciliation',
      message: `${pendingReconciliation} submission${pendingReconciliation !== 1 ? 's' : ''} waiting for verification`,
      href: '/admin/reconciliation',
    })
  }

  if (pendingExpenseCount > 0) {
    notifications.push({
      type: 'info',
      title: 'Expense Claims',
      message: `${pendingExpenseCount} expense claim${pendingExpenseCount !== 1 ? 's' : ''} pending approval`,
      href: '/admin/expenses',
    })
  }

  return NextResponse.json({ notifications, count: notifications.length })
}
