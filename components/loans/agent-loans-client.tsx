'use client'

import React, { useState, useEffect } from 'react'
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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
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
  today_payment_status: string | null
}

interface LoanRequest {
  id: string
  request_number: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  customer_id: string | null
  customer_name: string | null
  new_customer_name: string | null
  loan_amount: string
  interest_percentage: string
  daily_installment: string
  disbursement_date: string
  rejection_reason: string | null
  created_at: string
}

interface AgentCustomer {
  id: string
  full_name: string
  customer_code: string
}

interface RequestForm {
  customer_id: string
  new_customer_name: string
  new_customer_phone: string
  new_customer_area: string
  loan_amount: string
  interest_pct: string
  tenure: string
  penalty_amount: string
  disbursement_date: string
  notes: string
}

const emptyRequestForm: RequestForm = {
  customer_id: '', new_customer_name: '', new_customer_phone: '',
  new_customer_area: '', loan_amount: '', interest_pct: '',
  tenure: '', penalty_amount: '0', disbursement_date: '', notes: '',
}

interface Props {
  loans: AgentLoan[]
  agentName: string
}

function TodayBadge({ status, paymentStatus }: { status: string | null, paymentStatus: string | null }) {
  if (!status) return <span className="text-gray-400 text-sm">—</span>
  const s = status.toUpperCase()
  if (s === 'PAID') {
    if (paymentStatus === 'PENDING') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          Awaiting Approval
        </span>
      )
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Collected
      </span>
    )
  }
  if (s === 'PENDING') {
    // A payment may have been submitted (PENDING approval) even if schedule is still PENDING
    if (paymentStatus === 'PENDING') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          Awaiting Approval
        </span>
      )
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        Pending
      </span>
    )
  }
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
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestMode, setRequestMode] = useState<'existing' | 'new'>('existing')
  const [requestForm, setRequestForm] = useState<RequestForm>(emptyRequestForm)
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [customers, setCustomers] = useState<AgentCustomer[]>([])

  useEffect(() => {
    async function loadData() {
      setLoadingRequests(true)
      const [reqRes, custRes] = await Promise.all([
        fetch('/api/agent/loan-requests'),
        fetch('/api/customers'),
      ])
      if (reqRes.ok) setLoanRequests(await reqRes.json())
      if (custRes.ok) setCustomers(await custRes.json())
      setLoadingRequests(false)
    }
    loadData()
  }, [])

  async function handleRequestSubmit() {
    if (!requestForm.loan_amount || !requestForm.tenure || !requestForm.disbursement_date) {
      toast.error('Loan amount, tenure, and disbursement date are required')
      return
    }
    if (!requestForm.tenure || parseInt(requestForm.tenure) <= 0) {
      toast.error('Tenure must be greater than 0')
      return
    }
    if (requestMode === 'existing' && !requestForm.customer_id) {
      toast.error('Select a customer')
      return
    }
    if (requestMode === 'new' && !requestForm.new_customer_name) {
      toast.error('New customer name is required')
      return
    }
    setSubmittingRequest(true)
    try {
      const body: Record<string, unknown> = {
        loan_amount: parseFloat(requestForm.loan_amount),
        interest_percentage: parseFloat(requestForm.interest_pct) || 0,
        tenure: parseInt(requestForm.tenure),
        penalty_amount: parseFloat(requestForm.penalty_amount) || 0,
        disbursement_date: requestForm.disbursement_date,
        notes: requestForm.notes || undefined,
      }
      if (requestMode === 'existing') {
        body.customer_id = requestForm.customer_id
      } else {
        body.new_customer_name = requestForm.new_customer_name
        body.new_customer_phone = requestForm.new_customer_phone || undefined
        body.new_customer_area = requestForm.new_customer_area || undefined
      }
      const res = await fetch('/api/agent/loan-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to submit request'); return }
      toast.success(`Loan request ${data.request_number} submitted — pending admin approval`)
      setLoanRequests(prev => [data, ...prev])
      setRequestDialogOpen(false)
      setRequestForm(emptyRequestForm)
      setRequestMode('existing')
    } catch { toast.error('Network error') }
    finally { setSubmittingRequest(false) }
  }

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
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Loans</h1>
            <p className="text-gray-500">Welcome, {agentName}</p>
          </div>
          <Button onClick={() => setRequestDialogOpen(true)}>Request Loan</Button>
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">All My Loans</h2>
            <button
              onClick={async () => {
                const res = await fetch('/api/agent/loans')
                if (res.ok) setLoans(await res.json())
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Refresh
            </button>
          </div>
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
                      <TodayBadge status={loan.today_schedule_status} paymentStatus={loan.today_payment_status} />
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

        <div className="mt-8">
          <h2 id="loan-requests" className="text-lg font-semibold mb-3">My Loan Requests</h2>
          {loadingRequests ? (
            <Card><CardContent className="py-6 text-center text-gray-400 text-sm">Loading...</CardContent></Card>
          ) : loanRequests.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-gray-400 text-sm">No loan requests yet</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {loanRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-400">{req.request_number}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', {
                        'bg-yellow-100 text-yellow-700': req.status === 'PENDING',
                        'bg-green-100 text-green-700': req.status === 'APPROVED',
                        'bg-red-100 text-red-700': req.status === 'REJECTED',
                      })}>{req.status}</span>
                    </div>
                    <p className="text-sm font-medium">{req.customer_name ?? req.new_customer_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">₹{parseFloat(req.loan_amount).toLocaleString('en-IN')} loan · ₹{parseFloat(req.daily_installment).toLocaleString('en-IN')}/day</p>
                    {req.rejection_reason && <p className="text-xs text-red-500">{req.rejection_reason}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogTitle>Request Loan</DialogTitle>
          {/* Mode toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {(['existing', 'new'] as const).map(m => (
              <button key={m} onClick={() => setRequestMode(m)}
                className={cn('px-3 py-1 text-sm rounded-md font-medium capitalize transition-colors',
                  requestMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}>
                {m === 'existing' ? 'Existing Customer' : 'New Customer'}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {requestMode === 'existing' ? (
              <div className="space-y-1">
                <Label>Customer *</Label>
                <Select value={requestForm.customer_id} onValueChange={v => setRequestForm(f => ({ ...f, customer_id: v || '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Customer Name *</Label>
                  <Input value={requestForm.new_customer_name} onChange={e => setRequestForm(f => ({ ...f, new_customer_name: e.target.value }))} placeholder="Full name" />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={requestForm.new_customer_phone} onChange={e => setRequestForm(f => ({ ...f, new_customer_phone: e.target.value }))} placeholder="Phone number" />
                </div>
                <div className="space-y-1">
                  <Label>Area</Label>
                  <Input value={requestForm.new_customer_area} onChange={e => setRequestForm(f => ({ ...f, new_customer_area: e.target.value }))} placeholder="Area / locality" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Loan Amount *</Label>
                <Input type="number" step="0.01" min="0" value={requestForm.loan_amount} onChange={e => setRequestForm(f => ({ ...f, loan_amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Interest %</Label>
                <Input type="number" step="0.01" min="0" max="100" value={requestForm.interest_pct} onChange={e => setRequestForm(f => ({ ...f, interest_pct: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tenure (days) *</Label>
                <Input type="number" min="1" step="1" value={requestForm.tenure} onChange={e => setRequestForm(f => ({ ...f, tenure: e.target.value }))} />
                {requestForm.loan_amount && requestForm.tenure && parseInt(requestForm.tenure) > 0 && (
                  <p className="text-xs text-gray-500">
                    Daily: ₹{(parseFloat(requestForm.loan_amount) / parseInt(requestForm.tenure)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Penalty Amount</Label>
                <Input type="number" step="0.01" min="0" value={requestForm.penalty_amount} onChange={e => setRequestForm(f => ({ ...f, penalty_amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Disbursement Date *</Label>
              <Input type="date" value={requestForm.disbursement_date} onChange={e => setRequestForm(f => ({ ...f, disbursement_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={requestForm.notes} onChange={e => setRequestForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleRequestSubmit} disabled={submittingRequest} className="flex-1">
              {submittingRequest ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : 'Submit Request'}
            </Button>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { AgentLoansClient }
