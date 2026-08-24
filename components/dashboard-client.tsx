'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { TrendingUp, Users, AlertCircle, Banknote, Clock, CheckCircle2 } from 'lucide-react'

interface KPI {
  totalOutstanding: number
  totalCollected: number
  collectionPercent: number
  pendingCollections: number
  activeAgents: number
  attendanceToday: number
  totalEmployees: number
  pendingCash: number
}

interface TrendPoint { date: string; amount: number }
interface ModePoint { mode: string; amount: number }
interface Aging { current: number; overdue30: number; overdue60: number; overdue60plus: number }
interface ActivityRow {
  id: string
  actor_name: string | null
  action: string
  entity_type: string
  created_at: string | null
}

interface Props {
  kpi: KPI
  collectionTrend: TrendPoint[]
  paymentModes: ModePoint[]
  aging: Aging
  recentActivity: ActivityRow[]
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${n.toLocaleString()}`
}

function fmtFull(n: number) {
  return `₹${n.toLocaleString('en-IN')}`
}

function fmtDateTime(ts: string | null) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function actionLabel(action: string, entityType: string) {
  return `${action.replace(/_/g, ' ')} on ${entityType}`
}

const MODE_COLORS: Record<string, string> = {
  CASH: '#3b82f6',
  UPI: '#10b981',
  BANK_TRANSFER: '#8b5cf6',
  CHEQUE: '#f59e0b',
  OTHER: '#6b7280',
}

export function DashboardClient({ kpi, collectionTrend, paymentModes, aging, recentActivity }: Props) {
  const totalAging = kpi.totalOutstanding

  const kpiCards = [
    { label: 'Total Outstanding', value: fmtFull(kpi.totalOutstanding), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Collected (month)', value: fmtFull(kpi.totalCollected), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Collection Rate', value: `${kpi.collectionPercent}%`, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending Reviews', value: String(kpi.pendingCollections), icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Active Agents', value: String(kpi.activeAgents), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Attendance Today', value: `${kpi.attendanceToday}/${kpi.totalEmployees}`, icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50' },
  ]

  const agingData = [
    { label: 'Current', amount: aging.current, color: 'bg-green-500' },
    { label: '1–30 days', amount: aging.overdue30, color: 'bg-yellow-500' },
    { label: '31–60 days', amount: aging.overdue60, color: 'bg-orange-500' },
    { label: '60+ days', amount: aging.overdue60plus, color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview for this month</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(card => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="overflow-hidden">
              <CardContent className="p-3">
                <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                  <Icon size={14} className={card.color} />
                </div>
                <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pending cash alert */}
      {kpi.pendingCash > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2 text-sm">
          <Banknote size={16} className="text-orange-600 shrink-0" />
          <p className="text-orange-800">
            <span className="font-semibold">{fmtFull(kpi.pendingCash)}</span> in confirmed CASH collections pending handover/reconciliation.
          </p>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Collections Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Collections — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {collectionTrend.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={collectionTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip formatter={(v: any) => [fmtFull(Number(v)), 'Collected']} labelFormatter={(l: any) => `Date: ${l}`} />
                  <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Mode Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Payment Modes (Month)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {paymentModes.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={paymentModes} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="mode" tick={{ fontSize: 10 }} width={90} tickFormatter={v => v.replace('_', ' ')} />
                  <Tooltip formatter={(v: any) => fmtFull(Number(v))} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {paymentModes.map((entry) => (
                      <rect key={entry.mode} fill={MODE_COLORS[entry.mode] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Aging + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Outstanding Aging */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Outstanding Aging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agingData.map(item => {
              const pct = totalAging > 0 ? Math.round((item.amount / totalAging) * 100) : 0
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium">{fmtFull(item.amount)} <span className="text-gray-400 text-xs">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-2 ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="pt-1 border-t flex justify-between text-sm font-medium">
              <span>Total Outstanding</span>
              <span className="text-red-600">{fmtFull(totalAging)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No activity yet</div>
            ) : (
              <div className="divide-y">
                {recentActivity.map(item => (
                  <div key={item.id} className="px-4 py-2.5 flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 capitalize">{actionLabel(item.action, item.entity_type)}</p>
                      <p className="text-xs text-gray-500">{item.actor_name ?? 'System'} · {fmtDateTime(item.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
