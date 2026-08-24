import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  collections, dues, profiles, attendance, auditLogs,
} from '@/lib/db/schema'
import { sql, eq, and, inArray, notInArray, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DashboardClient, { DashboardClientProps } from '@/components/dashboard/dashboard-client'

// ── helpers ──────────────────────────────────────────────────────────────────

function todayIST() {
  // IST = UTC+5:30
  const istNow = new Date(Date.now() + 330 * 60_000)
  return istNow.toISOString().slice(0, 10)
}

function monthStartIST() {
  const istNow = new Date(Date.now() + 330 * 60_000)
  return `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-01`
}

function thirtyDaysAgoIST() {
  const d = new Date(Date.now() + 330 * 60_000 - 30 * 24 * 3600_000)
  return d.toISOString().slice(0, 10)
}

function n(v: string | null | undefined): number {
  return parseFloat(v ?? '0') || 0
}

// ── main page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id
  const role = (session.user as any).role as string

  // ── profile row ────────────────────────────────────────────────────────────
  const profileRow = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
    with: { branch: true } as any,
  }).catch(() => null)

  // ── non-admin view ─────────────────────────────────────────────────────────
  if (role !== 'ADMIN') {
    const today = todayIST()

    const [myAttRow, myPendingRow] = await Promise.all([
      db.select().from(attendance)
        .where(and(eq(attendance.employee_id, userId), eq(attendance.date, today)))
        .limit(1),
      db.select({ count: sql<string>`count(*)` }).from(collections)
        .where(and(eq(collections.agent_id, userId), eq(collections.status, 'PENDING'))),
    ])

    const myAtt = myAttRow[0]
    const myPending = parseInt(myPendingRow[0]?.count ?? '0', 10)

    const attLabel: Record<string, string> = {
      PRESENT: 'Present', LATE: 'Late', HALF_DAY: 'Half Day',
      ABSENT: 'Absent', LEAVE: 'On Leave', WEEK_OFF: 'Week Off',
    }
    const attVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PRESENT: 'default', LATE: 'secondary', HALF_DAY: 'outline',
      ABSENT: 'destructive', LEAVE: 'secondary', WEEK_OFF: 'outline',
    }

    return (
      <div className="max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {(profileRow as any)?.full_name ?? 'User'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Role: <span className="text-foreground font-medium">{role.replace(/_/g, ' ')}</span></p>
            <p>Branch: <span className="text-foreground font-medium">{(profileRow as any)?.branch?.name ?? 'Unassigned'}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Attendance today</span>
              {myAtt ? (
                <Badge variant={attVariant[myAtt.status] ?? 'outline'}>
                  {attLabel[myAtt.status] ?? myAtt.status}
                  {myAtt.check_in_at
                    ? ` · ${new Date(myAtt.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </Badge>
              ) : (
                <Badge variant="outline">Not checked in</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending collections</span>
              <span className="font-semibold">{myPending}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            { href: '/attendance', label: '📍 Check In' },
            { href: '/collections', label: '💰 My Collections' },
            { href: '/customers', label: '👥 My Customers' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-center rounded-lg border bg-card px-3 py-3 font-medium hover:bg-muted transition-colors text-center"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── admin: parallel data fetch ─────────────────────────────────────────────
  const today = todayIST()
  const monthStart = monthStartIST()
  const thirtyAgo = thirtyDaysAgoIST()

  const [
    expectedRow, collectedRow, outstandingRow,
    pendingRow, cashRow, agentsRow,
    presentRow, totalEmpRow,
    trendRows, modeRows,
    activityRows,
    agingCurrentRow, aging1_30Row, aging31_60Row, aging60Row,
  ] = await Promise.all([
    // 1 expected this month
    db.select({ t: sql<string>`coalesce(sum(${dues.amount}), '0')` })
      .from(dues)
      .where(and(
        notInArray(dues.status, ['CANCELLED']),
        sql`${dues.created_at} >= ${monthStart}::date`,
      )),
    // 2 collected this month
    db.select({ t: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        sql`${collections.collected_at} >= ${monthStart}::date`,
      )),
    // 3 total outstanding (all open dues)
    db.select({ t: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(notInArray(dues.status, ['PAID', 'CANCELLED'])),
    // 4 pending collections count
    db.select({ c: sql<string>`count(*)` })
      .from(collections)
      .where(eq(collections.status, 'PENDING')),
    // 5 confirmed cash (approximate handover)
    db.select({ t: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(eq(collections.status, 'CONFIRMED'), eq(collections.payment_mode, 'CASH'))),
    // 6 active agents
    db.select({ c: sql<string>`count(*)` })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true))),
    // 7 present today
    db.select({ c: sql<string>`count(*)` })
      .from(attendance)
      .where(and(
        eq(attendance.date, today),
        inArray(attendance.status, ['PRESENT', 'LATE', 'HALF_DAY']),
      )),
    // 8 total active employees
    db.select({ c: sql<string>`count(*)` })
      .from(profiles)
      .where(eq(profiles.is_active, true)),
    // 9 collection trend last 30 days
    db.select({
      date: sql<string>`(${collections.collected_at} at time zone 'Asia/Kolkata')::date::text`,
      amount: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    })
      .from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        sql`${collections.collected_at} >= ${thirtyAgo}::date`,
      ))
      .groupBy(sql`(${collections.collected_at} at time zone 'Asia/Kolkata')::date`)
      .orderBy(sql`(${collections.collected_at} at time zone 'Asia/Kolkata')::date`),
    // 10 payment mode breakdown
    db.select({
      mode: collections.payment_mode,
      amount: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    })
      .from(collections)
      .where(eq(collections.status, 'CONFIRMED'))
      .groupBy(collections.payment_mode)
      .orderBy(sql`sum(${collections.amount}) desc`),
    // 11 recent activity
    db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity_type: auditLogs.entity_type,
      actor_name: auditLogs.actor_name,
      created_at: auditLogs.created_at,
    })
      .from(auditLogs)
      .orderBy(desc(auditLogs.created_at))
      .limit(10),
    // 12-15 aging buckets
    db.select({ t: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(and(notInArray(dues.status, ['PAID', 'CANCELLED']), sql`${dues.due_date} >= current_date`)),
    db.select({ t: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(and(
        notInArray(dues.status, ['PAID', 'CANCELLED']),
        sql`${dues.due_date} < current_date`,
        sql`${dues.due_date} >= current_date - interval '30 days'`,
      )),
    db.select({ t: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(and(
        notInArray(dues.status, ['PAID', 'CANCELLED']),
        sql`${dues.due_date} < current_date - interval '30 days'`,
        sql`${dues.due_date} >= current_date - interval '60 days'`,
      )),
    db.select({ t: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(and(
        notInArray(dues.status, ['PAID', 'CANCELLED']),
        sql`${dues.due_date} < current_date - interval '60 days'`,
      )),
  ])

  const expected = n(expectedRow[0]?.t)
  const collected = n(collectedRow[0]?.t)

  const props: DashboardClientProps = {
    kpi: {
      total_expected: expected,
      total_collected: collected,
      total_outstanding: n(outstandingRow[0]?.t),
      collection_percent: expected > 0 ? (collected / expected) * 100 : 0,
      pending_collections_count: parseInt(pendingRow[0]?.c ?? '0', 10),
      pending_cash_handover: n(cashRow[0]?.t),
      active_agents: parseInt(agentsRow[0]?.c ?? '0', 10),
    },
    attendance: {
      present_count: parseInt(presentRow[0]?.c ?? '0', 10),
      total_employees: parseInt(totalEmpRow[0]?.c ?? '0', 10),
    },
    collectionTrend: trendRows.map((r) => ({
      date: r.date,
      amount: n(r.amount),
    })),
    paymentModes: modeRows.map((r) => ({
      mode: r.mode,
      amount: n(r.amount),
    })),
    recentActivity: activityRows.map((r) => ({
      id: r.id,
      action: r.action,
      entity_type: r.entity_type,
      actor_name: r.actor_name,
      created_at: r.created_at?.toISOString() ?? '',
    })),
    aging: {
      current: n(agingCurrentRow[0]?.t),
      overdue1_30: n(aging1_30Row[0]?.t),
      overdue31_60: n(aging31_60Row[0]?.t),
      overdue60plus: n(aging60Row[0]?.t),
    },
  }

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview for {today}</p>
      </div>
      <DashboardClient {...props} />
    </div>
  )
}
