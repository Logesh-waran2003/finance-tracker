'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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

interface LoanDetail {
  id: string
  loan_number: string
  loan_amount: string
  interest_percentage: string
  interest_amount: string
  disbursed_amount: string
  daily_installment: string
  penalty_amount: string
  principal_collected: string
  principal_outstanding: string
  penalty_outstanding: string
  total_outstanding: string
  status: string
  disbursement_date: string
  repayment_start_date: string
  customer_name: string
  assigned_agent_name: string
  notes: string | null
}

interface Schedule {
  id: string
  scheduled_date: string
  installment_amount: string
  status: string
  paid_at: string | null
  agent_name: string | null
  paid_amount: string | null
}

interface Payment {
  id: string
  payment_number: string
  scheduled_date: string
  payment_date: string
  amount: string
  payment_mode: string
  is_reversed: boolean
  reversed_at: string | null
  agent_name: string | null
}

interface Penalty {
  id: string
  scheduled_date: string | null
  penalty_amount: string
  is_waived: boolean
  waived_amount: string | null
  waiver_reason: string | null
}

interface Agent {
  id: string
  full_name: string
  employee_code: string | null
}

interface Props {
  loan: LoanDetail
  schedules: Schedule[]
  payments: Payment[]
  penalties: Penalty[]
  agents: Agent[]
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {status}
    </span>
  )
}

export function AdminLoanDetailClient({
  loan,
  schedules,
  payments: initialPayments,
  penalties: initialPenalties,
  agents,
}: Props) {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [penalties, setPenalties] = useState<Penalty[]>(initialPenalties)

  // Reverse dialog state
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reversePaymentId, setReversePaymentId] = useState<string>('')
  const [reverseReason, setReverseReason] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)

  // Waive dialog state
  const [waiveOpen, setWaiveOpen] = useState(false)
  const [waivePenaltyId, setWaivePenaltyId] = useState<string>('')
  const [waiveAmount, setWaiveAmount] = useState('')
  const [waiveReason, setWaiveReason] = useState('')
  const [waiveLoading, setWaiveLoading] = useState(false)

  // Bulk collect dialog state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkMode, setBulkMode] = useState('CASH')
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [currentLoan, setCurrentLoan] = useState(loan)

  // Reassign dialog state
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignAgentId, setReassignAgentId] = useState('')
  const [reassignLoading, setReassignLoading] = useState(false)

  function openReverse(paymentId: string) {
    setReversePaymentId(paymentId)
    setReverseReason('')
    setReverseOpen(true)
  }

  function openWaive(penaltyId: string) {
    setWaivePenaltyId(penaltyId)
    setWaiveAmount('')
    setWaiveReason('')
    setWaiveOpen(true)
  }

  async function handleReverse() {
    setReverseLoading(true)
    try {
      const res = await fetch(`/api/admin/loans/${loan.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: reversePaymentId, reason: reverseReason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to reverse payment')
        return
      }
      toast.success('Payment reversed')
      setPayments(prev =>
        prev.map(p =>
          p.id === reversePaymentId
            ? { ...p, is_reversed: true, reversed_at: new Date().toISOString() }
            : p,
        ),
      )
      setReverseOpen(false)
    } catch {
      toast.error('Network error')
    } finally {
      setReverseLoading(false)
    }
  }

  async function handleWaive() {
    setWaiveLoading(true)
    try {
      const res = await fetch(`/api/admin/loans/${loan.id}/waive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          penalty_id: waivePenaltyId,
          waived_amount: parseFloat(waiveAmount),
          reason: waiveReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to waive penalty')
        return
      }
      toast.success('Penalty waived')
      setPenalties(prev =>
        prev.map(p =>
          p.id === waivePenaltyId
            ? { ...p, is_waived: true, waived_amount: waiveAmount, waiver_reason: waiveReason }
            : p,
        ),
      )
      setWaiveOpen(false)
    } catch {
      toast.error('Network error')
    } finally {
      setWaiveLoading(false)
    }
  }

  async function handleReassign() {
    setReassignLoading(true)
    try {
      const res = await fetch(`/api/admin/loans/${loan.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: reassignAgentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to reassign agent')
        return
      }
      toast.success('Agent reassigned')
      setReassignOpen(false)
    } catch {
      toast.error('Network error')
    } finally {
      setReassignLoading(false)
    }
  }

  async function handleBulkCollect() {
    const amt = parseFloat(bulkAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setBulkLoading(true)
    try {
      const res = await fetch(`/api/admin/loans/${loan.id}/bulk-collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, payment_mode: bulkMode, notes: bulkNotes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); setBulkLoading(false); return }
      toast.success(`₹${data.total_collected} collected across ${data.payments_created} schedules. Loan: ${data.loan_status}`)
      setCurrentLoan(prev => ({ ...prev, principal_outstanding: data.principal_outstanding, status: data.loan_status }))
      setBulkOpen(false); setBulkAmount(''); setBulkNotes('')
    } catch { toast.error('Network error') }
    finally { setBulkLoading(false) }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{loan.loan_number}</h1>
        <StatusBadge status={currentLoan.status} />
        {(currentLoan.status === 'ACTIVE' || currentLoan.status === 'OVERDUE') && (
          <Button size="sm" className="ml-auto bg-green-600 hover:bg-green-700 text-white" onClick={() => setBulkOpen(true)}>
            Collect Cash
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Loan Amount / Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(loan.loan_amount)}</p>
            <p className="text-xs text-gray-400">{fmt(loan.disbursed_amount)} disbursed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Principal Collected / Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(loan.principal_collected)}</p>
            <p className="text-xs text-gray-400">{fmt(loan.principal_outstanding)} outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Penalty Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(loan.penalty_outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(loan.total_outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Daily Installment / Penalty/miss</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(loan.daily_installment)}</p>
            <p className="text-xs text-gray-400">{fmt(loan.penalty_amount)} penalty/miss</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="penalties">Penalties</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Amt</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Paid At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No schedule entries
                      </TableCell>
                    </TableRow>
                  ) : (
                    schedules.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{fmtDate(row.scheduled_date)}</TableCell>
                        <TableCell>{fmt(row.installment_amount)}</TableCell>
                        <TableCell>{row.paid_amount ? fmt(row.paid_amount) : '—'}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>{row.agent_name ?? '—'}</TableCell>
                        <TableCell>{fmtDate(row.paid_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                        No payments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.payment_number}</TableCell>
                        <TableCell>{fmtDate(row.payment_date)}</TableCell>
                        <TableCell>{fmt(row.amount)}</TableCell>
                        <TableCell>{row.payment_mode}</TableCell>
                        <TableCell>{row.agent_name ?? '—'}</TableCell>
                        <TableCell>
                          {row.is_reversed ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Reversed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!row.is_reversed && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openReverse(row.id)}
                            >
                              Reverse
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Penalties Tab */}
        <TabsContent value="penalties">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Penalty Amt</TableHead>
                    <TableHead>Waived</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {penalties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        No penalties
                      </TableCell>
                    </TableRow>
                  ) : (
                    penalties.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{fmtDate(row.scheduled_date)}</TableCell>
                        <TableCell>{fmt(row.penalty_amount)}</TableCell>
                        <TableCell>{row.waived_amount ? fmt(row.waived_amount) : '—'}</TableCell>
                        <TableCell>
                          {row.is_waived ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Waived
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Outstanding
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!row.is_waived && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openWaive(row.id)}
                            >
                              Waive
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{loan.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Agent</p>
                  <p className="font-medium">{loan.assigned_agent_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Disbursement Date</p>
                  <p className="font-medium">{fmtDate(loan.disbursement_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium">{fmtDate(loan.repayment_start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Interest</p>
                  <p className="font-medium">
                    {loan.interest_percentage}% ({fmt(loan.interest_amount)})
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{loan.notes ?? '—'}</p>
                </div>
              </div>
              <div className="mt-6">
                <Button variant="outline" onClick={() => setReassignOpen(true)}>
                  Reassign Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Collect Dialog */}
      <Dialog open={bulkOpen} onOpenChange={open => { if (!open) setBulkOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Collect Cash Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Remaining principal: <span className="font-semibold text-gray-800">{fmt(currentLoan.principal_outstanding)}</span></p>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount (₹)</label>
              <input
                type="number" min="1" step="0.01"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder={`Max ${fmt(currentLoan.principal_outstanding)}`}
                value={bulkAmount}
                onChange={e => setBulkAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Payment Mode</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={bulkMode} onChange={e => setBulkMode(e.target.value)}>
                {['CASH','UPI','BANK_TRANSFER','CHEQUE','OTHER'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Cash handed at office" value={bulkNotes} onChange={e => setBulkNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleBulkCollect} disabled={bulkLoading} className="bg-green-600 hover:bg-green-700 text-white">
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Collection'}
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reverse Payment Dialog */}
      <Dialog open={reverseOpen} onOpenChange={open => { if (!open) setReverseOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reverse Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea
                rows={3}
                placeholder="Reason for reversal..."
                value={reverseReason}
                onChange={e => setReverseReason(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleReverse}
              disabled={reverseLoading || !reverseReason.trim()}
            >
              {reverseLoading ? 'Processing...' : 'Confirm Reversal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waive Penalty Dialog */}
      <Dialog open={waiveOpen} onOpenChange={open => { if (!open) setWaiveOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Waive Penalty</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Waived Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={waiveAmount}
                onChange={e => setWaiveAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input
                placeholder="Reason for waiver..."
                value={waiveReason}
                onChange={e => setWaiveReason(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleWaive}
              disabled={waiveLoading || !waiveAmount || !waiveReason.trim()}
            >
              {waiveLoading ? 'Processing...' : 'Confirm Waiver'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Agent Dialog */}
      <Dialog open={reassignOpen} onOpenChange={open => { if (!open) setReassignOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Select Agent</Label>
              <Select value={reassignAgentId} onValueChange={v => v !== null && setReassignAgentId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                      {a.employee_code ? ` (${a.employee_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleReassign}
              disabled={reassignLoading || !reassignAgentId}
            >
              {reassignLoading ? 'Reassigning...' : 'Confirm Reassignment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
