'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TrendingUp, Users, Clock, AlertCircle, Banknote, CalendarCheck,
} from 'lucide-react'

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

interface CollectionTrendPoint {
  date: string
  amount: number
}

interface PaymentModePoint {
  mode: string
  amount: number
}

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

export interface DashboardClientProps {
  kpi: KPIData
  attendance: AttendanceData
  collectionTrend: CollectionTrendPoint[]
  paymentModes: PaymentModePoint[]
  recentActivity: ActivityItem[]
  aging: AgingData
}

function fmt(n: number) {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}k`
  return `₹${n.toLocaleString('en-IN')}`
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
}

export default function DashboardClient({
  kpi, attendance, collectionTrend, paymentModes, recentActivity, aging,
}: DashboardClientProps) {
  const collectionPct = kpi.collection_percent
  const pctColor =
    collectionPct >= 80 ? 'text-green-600' :
    collectionPct >= 50 ? 'text-yellow-600' : 'text-red-600'

  const kpiCards = [
    {
      label: 'Total Outstanding',
      value: fmt(kpi.total_outstanding),
      sub: 'All open dues',
      icon: AlertCircle,
      iconClass: 'text-red-500',
    },
    {
      label: 'Collected (Month)',
      value: fmt(kpi.total_collected),
      sub: `of ${fmt(kpi.total_expected)} expected`,
      icon: TrendingUp,
      iconClass: 'text-green-500',
    },
    {
      label: 'Collection %',
      value: `${collectionPct.toFixed(1)}%`,
      sub: 'Current month',
      icon: TrendingUp,
      iconClass: pctColor,
    },
    {
      label: 'Pending Reviews',
      value: String(kpi.pending_collections_count),
      sub: 'Awaiting confirmation',
      icon: Clock,
      iconClass: 'text-yellow-500',
    },
    {
      label: 'Active Agents',
      value: String(kpi.active_agents),
      sub: 'Collection agents',
      icon: Users,
      iconClass: 'text-blue-500',
    },
    {
      label: 'Attendance Today',
      value: `${attendance.present_count}/${attendance.total_employees}`,
      sub: 'Present / Total staff',
      icon: CalendarCheck,
      iconClass: 'text-purple-500',
    },
  ]

  const agingRows = [
    { label: 'Current (not overdue)', value: aging.current, barClass: 'bg-blue-400' },
    { label: 'Overdue 1–30 days',     value: aging.overdue1_30,  barClass: 'bg-yellow-400' },
    { label: 'Overdue 31–60 days',    value: aging.overdue31_60, barClass: 'bg-orange-400' },
    { label: 'Overdue 60+ days',      value: aging.overdue60plus, barClass: 'bg-red-500' },
  ]
  const agingTotal = agingRows.reduce((s, r) => s + r.value, 0)

  const modeData = paymentModes.map(p => ({
    ...p,
    mode: MODE_LABELS[p.mode] ?? p.mode,
  }))

  return (
    <div className="space-y-6">
      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs text-muted-foreground leading-tight">{card.label}</p>
                <card.icon className={`h-4 w-4 shrink-0 ${card.iconClass}`} />
              </div>
              <p className="text-xl font-bold tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collections — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionTrend.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No collections in the last 30 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={collectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Collected']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    fill="#eff6ff"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment Mode Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {modeData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No confirmed collections yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={modeData} layout="vertical">
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="mode"
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Aging + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Aging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agingRows.map((row) => {
              const pct = agingTotal > 0 ? (row.value / agingTotal) * 100 : 0
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium tabular-nums">{fmt(row.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.barClass} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <ul className="space-y-2.5">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.actor_name ?? 'System'}</span>{' '}
                      <span className="text-muted-foreground">
                        {item.action.toLowerCase().replace(/_/g, ' ')}{' '}
                        <span className="capitalize">
                          {item.entity_type.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {relativeTime(item.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
