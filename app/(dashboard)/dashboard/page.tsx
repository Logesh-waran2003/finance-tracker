import { auth } from '@/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  AlertCircle, ArrowLeftRight, Banknote, CalendarCheck, Clock,
  HandCoins, TrendingUp, Wallet, type LucideIcon,
} from 'lucide-react'

import { db } from '@/lib/db'
import {
  attendance, collections, customers, dues, loans, profiles, reconciliations,
} from '@/lib/db/schema'
import { Bi } from '@/components/ui/bi'
import { PageHeader } from '@/components/ui/page-header'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatTime } from '@/lib/format'
import type { LabelKey } from '@/lib/i18n'
import DashboardClient from '@/components/dashboard/dashboard-client'

/** IST = UTC+5:30. The business day is Asia/Kolkata, not the server's zone. */
function todayIST(): string {
  const istNow = new Date(Date.now() + 330 * 60_000)
  return istNow.toISOString().slice(0, 10)
}

function firstRow<T>(rows: T[]): T | undefined {
  return rows[0]
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id
  const role = session.user.role

  if (role === 'ADMIN') return <DashboardClient />

  const isAgent = role === 'COLLECTION_AGENT'
  const today = todayIST()

  // Money columns are Drizzle `numeric` — every sum comes back as a STRING and
  // is handed straight to <Money>. No parseFloat on the display path.
  const [
    collectedRow, pendingRow, outstandingRow, cashRow,
    submittedRow, loanRow, loanCountRow, attRow, branchRow,
  ] = await Promise.all([
    // Confirmed collections by this agent today
    db.select({ total: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(
        eq(collections.agent_id, userId),
        eq(collections.status, 'CONFIRMED'),
        sql`${collections.collected_at} >= ${today}::date`,
        sql`${collections.collected_at} < ${today}::date + 1`,
      )),

    // Collections waiting for an admin to approve
    db.select({
      count: sql<string>`count(*)`,
      total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    })
      .from(collections)
      .where(and(eq(collections.agent_id, userId), eq(collections.status, 'PENDING'))),

    // Open dues across the customers assigned to this agent
    db.select({
      total: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')`,
      count: sql<string>`count(*)`,
    })
      .from(dues)
      .innerJoin(customers, eq(dues.customer_id, customers.id))
      .where(and(
        eq(customers.assigned_agent_id, userId),
        sql`${dues.status} not in ('PAID', 'CANCELLED')`,
      )),

    // Cash confirmed today — the part that physically has to reach the office
    db.select({ total: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(
        eq(collections.agent_id, userId),
        eq(collections.status, 'CONFIRMED'),
        eq(collections.payment_mode, 'CASH'),
        sql`${collections.collected_at} >= ${today}::date`,
        sql`${collections.collected_at} < ${today}::date + 1`,
      )),

    // Already handed over today
    db.select({ total: sql<string>`coalesce(sum(${reconciliations.cash_submitted}), '0')` })
      .from(reconciliations)
      .where(and(eq(reconciliations.agent_id, userId), eq(reconciliations.date, today))),

    // Loans this agent is responsible for
    db.select({ total: sql<string>`coalesce(sum(${loans.total_outstanding}), '0')` })
      .from(loans)
      .where(and(
        eq(loans.assigned_agent_id, userId),
        inArray(loans.status, ['ACTIVE', 'DISBURSED', 'OVERDUE']),
      )),

    db.select({ count: sql<string>`count(*)` })
      .from(loans)
      .where(and(
        eq(loans.assigned_agent_id, userId),
        inArray(loans.status, ['ACTIVE', 'DISBURSED', 'OVERDUE']),
      )),

    db.select().from(attendance)
      .where(and(eq(attendance.employee_id, userId), eq(attendance.date, today)))
      .limit(1),

    db.select({ full_name: profiles.full_name }).from(profiles)
      .where(eq(profiles.id, userId)).limit(1),
  ])

  const collectedToday = firstRow(collectedRow)?.total ?? '0'
  const pendingCount = Number(firstRow(pendingRow)?.count ?? '0')
  const pendingValue = firstRow(pendingRow)?.total ?? '0'
  const outstanding = firstRow(outstandingRow)?.total ?? '0'
  const openDueCount = Number(firstRow(outstandingRow)?.count ?? '0')
  const loanOutstanding = firstRow(loanRow)?.total ?? '0'
  const loanCount = Number(firstRow(loanCountRow)?.count ?? '0')
  const att = firstRow(attRow)
  const userName = firstRow(branchRow)?.full_name ?? ''

  // Comparison/summing only — never the display path.
  const cashToHandOver = Math.max(
    0,
    Number(firstRow(cashRow)?.total ?? '0') - Number(firstRow(submittedRow)?.total ?? '0'),
  )

  return (
    <div className="space-y-5 md:max-w-4xl">
      <PageHeader
        titleKey="dashboard"
        subtitle={userName ? <span className="truncate">{userName}</span> : undefined}
      />

      {/* Money first. This screen used to open with four links that repeated
          the tab bar and showed no rupee figure at all.
          STAFF have no collections, customers, loans or settlement screen, so
          they get none of these tiles — four ₹0 boxes linking to routes they
          cannot open is worse than showing nothing. */}
      {isAgent && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            icon={TrendingUp}
            labelKey="collectedToday"
            value={collectedToday}
            intent="success"
            href="/collections"
          />
          <StatTile
            icon={AlertCircle}
            labelKey="outstanding"
            value={outstanding}
            intent="warning"
            caption={<><span className="tabular">{openDueCount}</span> <Bi k="openDues" /></>}
            href="/customers"
          />
          <StatTile
            icon={Clock}
            labelKey="toApprove"
            value={pendingValue}
            intent="info"
            caption={<><span className="tabular">{pendingCount}</span> <Bi k="pendingCollections" /></>}
            href="/collections"
          />
          <StatTile
            icon={HandCoins}
            labelKey="cashOnHand"
            value={cashToHandOver}
            intent={cashToHandOver > 0 ? 'danger' : 'neutral'}
            href="/reconciliation"
          />
        </div>
      )}

      {isAgent && loanCount > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            icon={Banknote}
            labelKey="loanOutstanding"
            value={loanOutstanding}
            intent="warning"
            caption={<><span className="tabular">{loanCount}</span> <Bi k="activeLoans" /></>}
            href="/loans"
            className="col-span-2"
          />
        </div>
      )}

      {/* Attendance is the one non-money fact an agent checks every morning. */}
      <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            <Bi k="attendanceTodayLabel" />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {att?.check_in_at && (
            <span className="text-sm text-muted-foreground tabular">
              {formatTime(att.check_in_at)}
            </span>
          )}
          {att ? (
            <StatusBadge status={att.status} />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              <Bi k="notCheckedIn" />
            </span>
          )}
        </div>
      </div>

      {/* Only destinations that are NOT already one tap away on the tab bar.
          Attendance, expenses and settlement live behind the More sheet. */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          <Bi k="quickActions" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickLink href="/attendance" icon={Clock} k="myAttendance" />
          {isAgent && (
            <QuickLink href="/reconciliation" icon={ArrowLeftRight} k="cashSettlement" />
          )}
          <QuickLink href="/expenses" icon={Wallet} k="officeExpenses" />
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  href, icon: Icon, k,
}: {
  href: string
  icon: LucideIcon
  k: LabelKey
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
    >
      <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <Bi k={k} className="min-w-0 truncate" />
    </Link>
  )
}
