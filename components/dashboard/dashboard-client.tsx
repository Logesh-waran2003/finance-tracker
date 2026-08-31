'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import {
  AlertCircle, CalendarCheck, Clock, HandCoins, MapPin, TrendingUp, Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Bi } from '@/components/ui/bi'
import { Money } from '@/components/ui/money'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/lib/api-client'
import {
  formatCount, formatDate, formatDateTime, formatMoney, formatPercent, formatTime,
} from '@/lib/format'
import { statusLabel, type LabelKey } from '@/lib/i18n'

interface KPIData {
  total_expected: number
  total_collected: number
  total_outstanding: number
  collection_percent: number
  pending_collections_count: number
  pending_cash_handover: number
  active_agents: number
}

interface AttendanceData {
  present_count: number
  total_employees: number
}

interface CollectionTrendPoint { date: string; amount: number }
interface PaymentModePoint { mode: string; amount: number }

interface ActivityItem {
  id: string
  action: string
  entity_type: string
  actor_name: string | null
  created_at: string
}

interface AgingData {
  current: number
  overdue1_30: number
  overdue31_60: number
  overdue60plus: number
}

interface AgentAttendanceRow {
  agent_name: string | null
  employee_code: string | null
  status: string | null
  check_in_at: string | null
  check_in_gps_lat: string | null
  check_in_gps_lng: string | null
}

interface DashboardData {
  kpi: KPIData
  attendance: AttendanceData
  collectionTrend: CollectionTrendPoint[]
  paymentModes: PaymentModePoint[]
  recentActivity: ActivityItem[]
  aging: AgingData
  agentAttendance: AgentAttendanceRow[]
}

type Period = 'daily' | 'monthly' | 'yearly'

const PERIOD_LABELS: Record<Period, LabelKey> = {
  daily: 'periodDaily',
  monthly: 'periodMonthly',
  yearly: 'periodYearly',
}

/** The five chart hues are CSS variables so they follow light/dark. Never hex. */
const CHART_VARS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
] as const

const AGING_KEYS: ReadonlyArray<readonly [keyof AgingData, LabelKey, string]> = [
  ['current', 'agingCurrent', 'bg-info'],
  ['overdue1_30', 'aging1to30', 'bg-warning'],
  ['overdue31_60', 'aging31to60', 'bg-chart-2'],
  ['overdue60plus', 'aging60plus', 'bg-danger'],
]

function humanise(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ')
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-11 w-56" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}

/**
 * Compact list of the same numbers a chart shows.
 *
 * At 360px a 30-point area chart is a smear and a five-category bar chart
 * loses its axis labels. An unreadable chart is worse than a list, so the
 * chart is `hidden md:block` and this is `md:hidden`.
 */
function ChartFallbackList({
  rows,
}: {
  rows: ReadonlyArray<{ key: string; label: React.ReactNode; value: number }>
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((row, i) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-muted-foreground">{row.label}</span>
            <Money value={row.value} size="row" />
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? (row.value / max) * 100 : 0}%`,
                backgroundColor: CHART_VARS[i % CHART_VARS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function DashboardClient() {
  const [period, setPeriod] = useState<Period>('monthly')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    const res = await apiGet<DashboardData>(`/api/admin/dashboard?period=${p}`)
    if (res.ok) setData(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [period, fetchData])

  if (!data) return <LoadingSkeleton />

  const { kpi, attendance, collectionTrend, paymentModes, recentActivity, aging, agentAttendance } = data

  const trendRows = collectionTrend.map(p => ({
    key: p.date,
    label: formatDate(p.date, period === 'yearly' ? 'month' : 'day'),
    value: p.amount,
  }))

  const modeRows = paymentModes.map(p => ({
    key: p.mode,
    label: statusLabel(p.mode).en,
    value: p.amount,
  }))

  const agingRows = AGING_KEYS.map(([key, labelKey, bar]) => ({
    key,
    labelKey,
    bar,
    value: aging[key],
  }))
  const agingTotal = agingRows.reduce((s, r) => s + r.value, 0)

  const attendanceColumns: DataListColumn<AgentAttendanceRow>[] = [
    {
      key: 'agent',
      header: <Bi k="agent" />,
      primary: true,
      cell: row => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.agent_name ?? '—'}</p>
          {row.employee_code && (
            <p className="truncate text-xs text-muted-foreground">{row.employee_code}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: row => <StatusBadge status={row.status ?? 'ABSENT'} />,
    },
    {
      key: 'checkIn',
      header: <Bi k="checkInTime" />,
      cell: row => (
        <span className="tabular text-sm text-muted-foreground">
          {row.check_in_at ? formatTime(row.check_in_at) : '—'}
        </span>
      ),
    },
    {
      key: 'location',
      header: <Bi k="location" />,
      cell: row =>
        row.check_in_gps_lat && row.check_in_gps_lng ? (
          // Not <GMapsLink>: that component hardcodes `text-blue-600` and an
          // English string, both of which the contract forbids here.
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(`${row.check_in_gps_lat},${row.check_in_gps_lng}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <MapPin aria-hidden="true" className="size-4" />
            <Bi k="viewOnMap" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Period toggle */}
      <div
        role="group"
        aria-label="Period"
        className="flex w-full gap-1 rounded-lg bg-muted p-1 md:w-fit"
      >
        {(['daily', 'monthly', 'yearly'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            disabled={loading}
            aria-pressed={period === p}
            className={cn(
              'min-h-11 flex-1 rounded-md px-4 text-sm font-medium transition-colors md:flex-none',
              period === p
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Bi k={PERIOD_LABELS[p]} />
          </button>
        ))}
      </div>

      {/* Money first, four tiles, numbers dominant. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={TrendingUp}
          labelKey="collected"
          value={kpi.total_collected}
          intent="success"
          caption={
            <>
              {formatPercent(kpi.collection_percent)} <Bi k="ofExpected" />{' '}
              <span className="tabular">{formatMoney(kpi.total_expected, { compact: true })}</span>
            </>
          }
          href="/admin/collections"
        />
        <StatTile
          icon={AlertCircle}
          labelKey="outstanding"
          value={kpi.total_outstanding}
          intent="warning"
          captionKey="allOpenDuesCaption"
          href="/admin/customers"
        />
        <StatTile
          icon={Clock}
          labelKey="toApprove"
          value={kpi.pending_collections_count}
          kind="count"
          intent="info"
          captionKey="awaitingConfirmation"
          href="/admin/collections"
        />
        <StatTile
          icon={HandCoins}
          labelKey="cashOnHand"
          value={kpi.pending_cash_handover}
          intent={kpi.pending_cash_handover > 0 ? 'danger' : 'neutral'}
          href="/admin/reconciliation"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={Users}
          labelKey="activeAgents"
          value={kpi.active_agents}
          kind="count"
          intent="neutral"
          href="/admin/employees"
        />
        <StatTile
          icon={CalendarCheck}
          labelKey="presentToday"
          value={attendance.present_count}
          kind="count"
          intent={attendance.present_count > 0 ? 'success' : 'neutral'}
          caption={
            <>
              <Bi k="agentsOnDuty" /> ·{' '}
              <span className="tabular">{formatCount(attendance.total_employees)}</span>
            </>
          }
          href="/admin/attendance"
        />
      </div>

      {/* Charts. Every one has a phone list of the same numbers. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <Bi k="collectionTrend" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                <Bi k="noDataYet" />
              </p>
            ) : (
              <>
                {/* Phone: last 7 points as a list. 30 points at 360px is a smear. */}
                <ChartFallbackList rows={trendRows.slice(-7)} />
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={collectionTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickFormatter={(v: string) =>
                          formatDate(v, period === 'yearly' ? 'month' : 'day')
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        width={56}
                        tickFormatter={(v: number) => formatMoney(v, { compact: true })}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--popover)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                          color: 'var(--popover-foreground)',
                        }}
                        formatter={(v: unknown) => formatMoney(typeof v === 'number' || typeof v === 'string' ? v : 0)}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <Bi k="paymentModeBreakdown" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modeRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                <Bi k="noDataYet" />
              </p>
            ) : (
              <>
                <ChartFallbackList rows={modeRows} />
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={modeRows} layout="vertical">
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickFormatter={(v: number) => formatMoney(v, { compact: true })}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={96}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--muted)' }}
                        contentStyle={{
                          background: 'var(--popover)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                          color: 'var(--popover-foreground)',
                        }}
                        formatter={(v: unknown) => formatMoney(typeof v === 'number' || typeof v === 'string' ? v : 0)}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {modeRows.map((row, i) => (
                          <Cell key={row.key} fill={CHART_VARS[i % CHART_VARS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aging is already a list at every width — a stacked bar of four buckets
          was never readable at 360px. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <Bi k="outstandingAging" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agingRows.map(row => (
              <div key={row.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-muted-foreground">
                    <Bi k={row.labelKey} />
                  </span>
                  <Money value={row.value} size="row" />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', row.bar)}
                    style={{ width: `${agingTotal > 0 ? (row.value / agingTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <Bi k="recentActivity" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                <Bi k="noRecentActivity" />
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recentActivity.map(item => (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">
                          {item.actor_name ?? <Bi k="system" />}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {humanise(item.action)} {humanise(item.entity_type)}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">
                      {formatDateTime(item.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          <Bi k="agentAttendanceToday" />
        </h2>
        <DataList
          items={agentAttendance}
          getKey={(row, i) => `${row.employee_code ?? row.agent_name ?? 'row'}-${i}`}
          columns={attendanceColumns}
          empty={<EmptyState icon={Users} titleKey="noAttendanceRecords" />}
        />
      </div>
    </div>
  )
}
