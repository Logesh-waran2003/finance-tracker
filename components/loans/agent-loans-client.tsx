'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
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

function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined) return '₹0'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return `₹${(isNaN(v) ? 0 : v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type PaymentMode = 'CASH' | 'UPI' | 'OTHER'

interface AgentLoan {
  id: string
  loan_number: string
  customer_name: string
  daily_installment: string
  principal_outstanding: string
  penalty_outstanding: string
  total_outstanding: string
  status: string
  today_schedule_id: string | null
  today_schedule_status: string | null
  today_installment_amount: string | null
}

interface Props {
  loans: AgentLoan[]
  agentName: string
}

function TodayBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-sm">—</span>
  const s = status.toUpperCase()
  if (s === 'PAID')
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Collected
      </span>
    )
  if (s === 'PENDING')
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        Pending
      </span>
    )
  if (s === 'MISSED')
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        Missed
      </span>
    )
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      {status}
    </span>
  )
}

function CollectCard({
  loan,
  onCollected,
}: {
  loan: AgentLoan
  onCollected: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<PaymentMode>('CASH')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/agent/loans/${loan.id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_mode: mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Collection failed')
        return
      }
      toast.success(
        `${fmt(loan.today_installment_amount)} collected from ${loan.customer_name}`
      )
      onCollected(loan.id)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const modes: { label: string; value: PaymentMode }[] = [
    { label: 'Cash', value: 'CASH' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Other', value: 'OTHER' },
  ]

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{loan.customer_name}</p>
            <p className="text-sm text-gray-500">{loan.loan_number}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Principal O/S: {fmt(loan.principal_outstanding)}
            </p>
          </div>
          {!expanded && (
            <Button
              variant="default"
              size="lg"
              onClick={() => setExpanded(true)}
              className="shrink-0"
            >
              Collect {fmt(loan.today_installment_amount)}
            </Button>
          )}
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Payment mode</p>
            <div className="flex gap-2">
              {modes.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                    mode === m.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                onClick={handleConfirm}
                disabled={loading}
                className="min-w-[160px]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirm Collection
              </Button>
              <button
                onClick={() => {
                  setExpanded(false)
                  setMode('CASH')
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AgentLoansClient({ loans: initialLoans, agentName }: Props) {
  const [loans, setLoans] = useState<AgentLoan[]>(initialLoans)

  function markCollected(id: string) {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, today_schedule_status: 'PAID' } : l
      )
    )
  }

  const activeCount = loans.filter(
    (l) => l.status === 'ACTIVE' || l.status === 'OVERDUE'
  ).length

  const todayExpected = loans
    .filter((l) => l.today_schedule_status !== null && l.today_installment_amount !== null)
    .reduce((sum, l) => sum + parseFloat(l.today_installment_amount ?? '0'), 0)

  const todayCollected = loans
    .filter((l) => l.today_schedule_status === 'PAID')
    .reduce((sum, l) => sum + parseFloat(l.today_installment_amount ?? '0'), 0)

  const todayPendingCount = loans.filter(
    (l) => l.today_schedule_status === 'PENDING'
  ).length

  const pendingLoans = loans.filter((l) => l.today_schedule_status === 'PENDING')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Loans</h1>
        <p className="text-gray-500">Welcome, {agentName}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">My Active Loans</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Today&apos;s Expected</p>
            <p className="text-2xl font-bold">{fmt(todayExpected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Today&apos;s Collected</p>
            <p className="text-2xl font-bold">{fmt(todayCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Today&apos;s Pending</p>
            <p className="text-2xl font-bold">{todayPendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Today&apos;s Collections</h2>
        {pendingLoans.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              No pending collections today 🎉
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingLoans.map((loan) => (
              <CollectCard key={loan.id} loan={loan} onCollected={markCollected} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">All My Loans</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Loan #</TableHead>
                <TableHead>Principal O/S</TableHead>
                <TableHead>Total O/S</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Today</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">
                    {loan.customer_name}
                  </TableCell>
                  <TableCell>{loan.loan_number}</TableCell>
                  <TableCell>{fmt(loan.principal_outstanding)}</TableCell>
                  <TableCell>{fmt(loan.total_outstanding)}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        STATUS_COLOR[loan.status] ?? 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {loan.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TodayBadge status={loan.today_schedule_status} />
                  </TableCell>
                </TableRow>
              ))}
              {loans.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-gray-400 py-10"
                  >
                    No loans assigned
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}

export { AgentLoansClient }
