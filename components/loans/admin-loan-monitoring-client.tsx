'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  DRAFT: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  MISSED: 'bg-red-100 text-red-700',
}

function fmt(n: number | string) {
  const v = typeof n === 'string' ? parseFloat(n) : n
  return `₹${(isNaN(v) ? 0 : v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface MonitoringRow {
  customer_name: string
  agent_name: string
  loan_number: string
  daily_due: string
  paid: string | null
  penalty: string | null
  schedule_status: string
  principal_outstanding: string
}

interface Agent {
  id: string
  full_name: string
}

interface Summary {
  expected: number
  collected: number
  pending: number
  missed: number
}

interface Props {
  initialRows: MonitoringRow[]
  initialDate: string
  agents: Agent[]
  summary: Summary
}

const STATUS_FILTERS = ['All', 'Pending', 'Paid', 'Missed'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default function AdminLoanMonitoringClient({
  initialRows,
  initialDate,
  agents,
  summary: initialSummary,
}: Props) {
  const [rows, setRows] = useState<MonitoringRow[]>(initialRows)
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [date, setDate] = useState(initialDate)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  async function fetchData(d: string, aId: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date: d })
      if (aId) params.set('agent_id', aId)
      const res = await fetch(`/api/admin/loans/monitoring?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setRows(data.rows ?? [])
      setSummary(data.summary ?? { expected: 0, collected: 0, pending: 0, missed: 0 })
    } catch {
      // keep existing data on error
    } finally {
      setLoading(false)
    }
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value
    setDate(d)
    fetchData(d, agentId)
  }

  function handleAgentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const a = e.target.value
    setAgentId(a)
    fetchData(date, a)
  }

  const filteredRows = rows.filter((r) => {
    if (statusFilter === 'All') return true
    return r.schedule_status.toUpperCase() === statusFilter.toUpperCase()
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Loan Monitoring</h1>
        <p className="text-gray-500">Today&apos;s collection status</p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="date"
          value={date}
          onChange={handleDateChange}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <select
          value={agentId}
          onChange={handleAgentChange}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Expected Today</p>
            <p className="text-2xl font-bold">{fmt(summary.expected)}</p>
            <p className="text-xs text-gray-400 mt-1">Total scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Collected</p>
            <p className="text-2xl font-bold">{fmt(summary.collected)}</p>
            <p className="text-xs text-gray-400 mt-1">Payments received</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold">{summary.pending}</p>
            <p className="text-xs text-gray-400 mt-1">Due today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Missed</p>
            <p
              className={cn(
                'text-2xl font-bold',
                summary.missed > 0 ? 'text-red-600' : ''
              )}
            >
              {summary.missed}
            </p>
            <p className="text-xs text-gray-400 mt-1">Not collected</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              statusFilter === f
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 hover:bg-gray-50'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Loan #</TableHead>
              <TableHead>Daily Due</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Penalty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Principal O/S</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-gray-400 py-10"
                >
                  No schedules for this date
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    {row.customer_name}
                  </TableCell>
                  <TableCell>{row.agent_name}</TableCell>
                  <TableCell>{row.loan_number}</TableCell>
                  <TableCell>{fmt(row.daily_due)}</TableCell>
                  <TableCell>{row.paid ? fmt(row.paid) : '—'}</TableCell>
                  <TableCell>
                    {row.penalty ? fmt(row.penalty) : '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        STATUS_COLOR[row.schedule_status] ??
                          'bg-gray-100 text-gray-500'
                      )}
                    >
                      {row.schedule_status}
                    </span>
                  </TableCell>
                  <TableCell>{fmt(row.principal_outstanding)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

export { AdminLoanMonitoringClient }
