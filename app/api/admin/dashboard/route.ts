import { db } from '@/lib/db'
import { collections, dues, profiles, attendance, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { sql, eq, and, inArray, notInArray, desc } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

// ── date helpers (IST = UTC+5:30) ─────────────────────────────────────────────

/**
 * IST date helpers.
 *
 * `new Date(Date.now() + 330*60_000)` shifts the instant, but the shift is only
 * readable with the `getUTC*` accessors. `monthStartIST` and `yearStartIST` used
 * the LOCAL accessors (`getFullYear`/`getMonth`) on that already-shifted value,
 * so on a machine running in IST they double-shifted by 11 hours.
 *
 * Consequence: for the last ~11 hours of every month, `monthStartIST()` returned
 * the FIRST OF THE NEXT MONTH, so the KPI filter became
 * `collected_at >= <a future date>` and the admin dashboard reported ₹0
 * collected for the month while its own trend chart — which used a different,
 * correct helper — showed real money.
 *
 * Everything now derives from one IST formatter, matching istToday() in
 * lib/modules/reconciliation/service.ts.
 */
const IST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })

/** YYYY-MM-DD in IST. */
function istDate(at: Date = new Date()): string {
  return IST_DATE.format(at)
}

function todayIST() {
  return istDate()
}

function monthStartIST() {
  return `${istDate().slice(0, 7)}-01`
}

function yearStartIST() {
  return `${istDate().slice(0, 4)}-01-01`
}

function daysAgoIST(days: number) {
  return istDate(new Date(Date.now() - days * 24 * 3600_000))
}

function sevenDaysAgoIST() {
  return daysAgoIST(7)
}

function thirtyDaysAgoIST() {
  return daysAgoIST(30)
}

function n(v: string | null | undefined): number {
  return parseFloat(v ?? '0') || 0
}

type Period = 'daily' | 'monthly' | 'yearly'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const { searchParams } = new URL(request.url)
  const rawPeriod = searchParams.get('period') ?? 'monthly'
  const period: Period = ['daily', 'monthly', 'yearly'].includes(rawPeriod)
    ? (rawPeriod as Period)
    : 'monthly'

  const today = todayIST()

  // ── period-dependent date bounds ──────────────────────────────────────────
  const kpiStart =
    period === 'daily' ? today :
    period === 'monthly' ? monthStartIST() :
    yearStartIST()

  // For daily: collected_at >= today AND collected_at < today + 1
  // For monthly/yearly: collected_at >= periodStart
  const kpiWhereCollected =
    period === 'daily'
      ? sql`${collections.collected_at} >= ${today}::date AND ${collections.collected_at} < ${today}::date + 1`
      : sql`${collections.collected_at} >= ${kpiStart}::date`

  const kpiWhereDues =
    period === 'daily'
      ? sql`${dues.created_at} >= ${today}::date AND ${dues.created_at} < ${today}::date + 1`
      : sql`${dues.created_at} >= ${kpiStart}::date`

  // ── trend date bounds ─────────────────────────────────────────────────────
  const trendStart =
    period === 'daily' ? sevenDaysAgoIST() :
    period === 'monthly' ? thirtyDaysAgoIST() :
    yearStartIST()

  const trendWhereDate = sql`${collections.collected_at} >= ${trendStart}::date`

  // ── trend grouping expression ─────────────────────────────────────────────
  const trendGroupExpr =
    period === 'yearly'
      ? sql<string>`date_trunc('month', ${collections.collected_at} at time zone 'Asia/Kolkata')::date::text`
      : sql<string>`(${collections.collected_at} at time zone 'Asia/Kolkata')::date::text`

  const trendGroupBy =
    period === 'yearly'
      ? sql`date_trunc('month', ${collections.collected_at} at time zone 'Asia/Kolkata')::date`
      : sql`(${collections.collected_at} at time zone 'Asia/Kolkata')::date`

  const [
    expectedRow, collectedRow, outstandingRow,
    pendingRow, cashRow, agentsRow,
    presentRow, totalEmpRow,
    trendRows, modeRows,
    activityRows,
    agingCurrentRow, aging1_30Row, aging31_60Row, aging60Row,
  ] = await Promise.all([
    // 1 expected in period (based on dues.created_at)
    db.select({ t: sql<string>`coalesce(sum(${dues.amount}), '0')` })
      .from(dues)
      .where(and(
        notInArray(dues.status, ['CANCELLED']),
        kpiWhereDues,
      )),

    // 2 collected in period
    db.select({ t: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        kpiWhereCollected,
      )),

    // 3 total outstanding (all open dues — not period-filtered)
    db.select({ t: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(notInArray(dues.status, ['PAID', 'CANCELLED'])),

    // 4 pending collections count (always total)
    db.select({ c: sql<string>`count(*)` })
      .from(collections)
      .where(eq(collections.status, 'PENDING')),

    // 5 confirmed cash handover (always total)
    db.select({ t: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(eq(collections.status, 'CONFIRMED'), eq(collections.payment_mode, 'CASH'))),

    // 6 active agents (always total)
    db.select({ c: sql<string>`count(*)` })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true))),

    // 7 present today (always today)
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

    // 9 collection trend
    db.select({
      date: trendGroupExpr,
      amount: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    })
      .from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        trendWhereDate,
      ))
      .groupBy(trendGroupBy)
      .orderBy(trendGroupBy),

    // 10 payment mode breakdown in period
    db.select({
      mode: collections.payment_mode,
      amount: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    })
      .from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        kpiWhereCollected,
      ))
      .groupBy(collections.payment_mode)
      .orderBy(sql`sum(${collections.amount}) desc`),

    // 11 recent activity (always last 10)
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

    // 12-15 aging buckets (always based on current_date)
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

  // Per-agent attendance for today
  const agentAttendanceRows = await db
    .select({
      id: attendance.id,
      agent_name: profiles.full_name,
      employee_code: profiles.employee_code,
      status: attendance.status,
      check_in_at: attendance.check_in_at,
      check_in_gps_lat: attendance.check_in_gps_lat,
      check_in_gps_lng: attendance.check_in_gps_lng,
    })
    .from(profiles)
    .leftJoin(
      attendance,
      and(eq(attendance.employee_id, profiles.id), eq(attendance.date, today))
    )
    .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true)))
    .orderBy(profiles.full_name)

  return NextResponse.json({
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
    agentAttendance: agentAttendanceRows.map(r => ({
      agent_name: r.agent_name,
      employee_code: r.employee_code,
      status: r.status ?? null,
      check_in_at: r.check_in_at?.toISOString() ?? null,
      check_in_gps_lat: r.check_in_gps_lat,
      check_in_gps_lng: r.check_in_gps_lng,
    })),
    period,
  })
}
