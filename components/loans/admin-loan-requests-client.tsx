'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LoanRequestRow {
  id: string
  request_number: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  customer_id: string | null
  customer_name: string | null
  customer_code: string | null
  new_customer_name: string | null
  new_customer_phone: string | null
  new_customer_area: string | null
  loan_amount: string
  interest_percentage: string
  daily_installment: string
  tenure: number | null
  penalty_amount: string
  disbursement_date: string
  notes: string | null
  rejection_reason: string | null
  requested_by: string
  agent_name: string | null
  created_at: string | null
  created_loan_id: string | null
}

interface Agent {
  id: string
  full_name: string
  employee_code: string | null
}

interface Props {
  initial: LoanRequestRow[]
  agents: Agent[]
}

interface CustomerSummary {
  customer: {
    id: string
    full_name: string
    customer_code: string | null
    phone: string | null
    area: string | null
    city: string | null
    opening_balance: string
    is_active: boolean
  }
  summary: {
    total_outstanding: string
    dues_outstanding: string
    loan_outstanding: string
    active_loan_count: number
  }
  dues: {
    id: string
    invoice_number: string | null
    amount: string
    outstanding_amount: string
    due_date: string | null
    status: string
  }[]
  active_loans: {
    id: string
    loan_number: string
    loan_amount: string
    total_outstanding: string
    status: string
    disbursement_date: string
  }[]
  recent_collections: {
    id: string
    amount: string
    payment_mode: string
    collected_at: string | null
    status: string
  }[]
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

type FilterTab = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

function fmt(n: string | number | null) {
  const v = parseFloat(String(n ?? '0'))
  return `₹${isNaN(v) ? 0 : v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminLoanRequestsClient({ initial, agents: _agents }: Props) {
  const [requests, setRequests] = useState<LoanRequestRow[]>(initial)
  const [filter, setFilter] = useState<FilterTab>('ALL')

  // Approve dialog
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [submittingApprove, setSubmittingApprove] = useState(false)

  // Reject dialog
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [submittingReject, setSubmittingReject] = useState(false)

  // Customer summary dialog
  const [viewCustomerId, setViewCustomerId] = useState<string | null>(null)
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | null>(null)
  const [loadingCustomer, setLoadingCustomer] = useState(false)

  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter)

  async function handleViewCustomer(customerId: string) {
    setViewCustomerId(customerId)
    setCustomerSummary(null)
    setLoadingCustomer(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/summary`)
      if (!res.ok) { toast.error('Failed to load customer data'); return }
      setCustomerSummary(await res.json())
    } catch {
      toast.error('Network error')
    } finally {
      setLoadingCustomer(false)
    }
  }

  async function handleApprove() {
    setSubmittingApprove(true)
    try {
      const res = await fetch(`/api/admin/loan-requests/${approvingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to approve'); return }
      toast.success('Loan request approved and loan created')
      setRequests(prev => prev.map(r =>
        r.id === approvingId ? { ...r, status: 'APPROVED', created_loan_id: data.loan_id ?? r.created_loan_id } : r
      ))
      setApprovingId(null)
    } catch { toast.error('Network error') }
    finally { setSubmittingApprove(false) }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return }
    setSubmittingReject(true)
    try {
      const res = await fetch(`/api/admin/loan-requests/${rejectingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: rejectReason }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to reject'); return }
      toast.success('Loan request rejected')
      setRequests(prev => prev.map(r =>
        r.id === rejectingId ? { ...r, status: 'REJECTED', rejection_reason: rejectReason } : r
      ))
      setRejectingId(null)
      setRejectReason('')
    } catch { toast.error('Network error') }
    finally { setSubmittingReject(false) }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
  ]

  return (
    <>
      <div className="px-4 py-5 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Loan Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and action agent-submitted loan requests</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                'flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm rounded-md font-medium transition-colors whitespace-nowrap',
                filter === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Requests list */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400 text-sm">
              No {filter !== 'ALL' ? filter.toLowerCase() : ''} loan requests
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => (
              <Card key={req.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Top row: request number + status badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-400">{req.request_number}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[req.status])}>
                      {req.status}
                    </span>
                  </div>

                  {/* Customer name + View button (existing customers only) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-base leading-tight">
                        {req.customer_name ?? req.new_customer_name ?? '—'}
                      </p>
                      {req.customer_code && (
                        <p className="text-xs text-gray-400">{req.customer_code}</p>
                      )}
                      {req.new_customer_phone && (
                        <p className="text-xs text-gray-400">
                          {req.new_customer_phone}{req.new_customer_area ? ` · ${req.new_customer_area}` : ''}
                        </p>
                      )}
                    </div>
                    {req.customer_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() => handleViewCustomer(req.customer_id!)}
                      >
                        View
                      </Button>
                    )}
                  </div>

                  {/* Loan details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block">Amount</span>
                      <span className="font-medium">{fmt(req.loan_amount)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Daily</span>
                      <span className="font-medium">{fmt(req.daily_installment)}/day</span>
                    </div>
                    {req.tenure && (
                      <div>
                        <span className="text-xs text-gray-400 block">Tenure</span>
                        <span>{req.tenure} days</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-400 block">Interest</span>
                      <span>{parseFloat(req.interest_percentage)}%</span>
                    </div>
                    {parseFloat(req.penalty_amount) > 0 && (
                      <div>
                        <span className="text-xs text-gray-400 block">Penalty</span>
                        <span>{fmt(req.penalty_amount)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-400 block">Disburse</span>
                      <span>{fmtDate(req.disbursement_date)}</span>
                    </div>
                  </div>

                  {req.notes && <p className="text-xs text-gray-500 italic">{req.notes}</p>}
                  {req.rejection_reason && (
                    <p className="text-xs text-red-500">Rejected: {req.rejection_reason}</p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
                    <p className="text-xs text-gray-400 min-w-0 truncate">
                      By {req.agent_name ?? '—'} · {fmtDate(req.created_at)}
                    </p>
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => setApprovingId(req.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => { setRejectingId(req.id); setRejectReason('') }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Customer Summary Dialog */}
      <Dialog
        open={!!viewCustomerId}
        onOpenChange={open => { if (!open) { setViewCustomerId(null); setCustomerSummary(null) } }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>Customer Profile</DialogTitle>
          <DialogDescription className="sr-only">
            Customer history and outstanding summary
          </DialogDescription>

          {loadingCustomer && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {!loadingCustomer && customerSummary && (
            <div className="space-y-4 mt-1">
              {/* Info */}
              <div>
                <p className="font-semibold text-base">{customerSummary.customer.full_name}</p>
                <p className="text-xs text-gray-400">{customerSummary.customer.customer_code}</p>
                {customerSummary.customer.phone && (
                  <p className="text-xs text-gray-500 mt-0.5">{customerSummary.customer.phone}</p>
                )}
                {(customerSummary.customer.area || customerSummary.customer.city) && (
                  <p className="text-xs text-gray-500">
                    {[customerSummary.customer.area, customerSummary.customer.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Outstanding summary */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-700 font-medium mb-2">Outstanding</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-orange-700 text-sm">{fmt(customerSummary.summary.total_outstanding)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Dues</p>
                    <p className="font-medium text-sm">{fmt(customerSummary.summary.dues_outstanding)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Loans</p>
                    <p className="font-medium text-sm">{fmt(customerSummary.summary.loan_outstanding)}</p>
                  </div>
                </div>
              </div>

              {/* Active Loans */}
              {customerSummary.active_loans.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">
                    Active Loans ({customerSummary.summary.active_loan_count})
                  </p>
                  <div className="space-y-1.5">
                    {customerSummary.active_loans.map(l => (
                      <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-mono text-xs text-gray-500">{l.loan_number}</p>
                          <p className="text-xs text-gray-400">{fmtDate(l.disbursement_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Outstanding</p>
                          <p className="font-medium text-orange-600 text-xs">{fmt(l.total_outstanding)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unpaid Dues */}
              {customerSummary.dues.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Unpaid Dues</p>
                  <div className="space-y-1.5">
                    {customerSummary.dues.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs">{d.invoice_number ?? 'No invoice'}</p>
                          {d.due_date && <p className="text-xs text-gray-400">Due: {fmtDate(d.due_date)}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-xs">{fmt(d.outstanding_amount)}</p>
                          <p className="text-xs text-gray-400">{d.status.replace('_', ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Collections */}
              {customerSummary.recent_collections.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Recent Collections</p>
                  <div className="space-y-1.5">
                    {customerSummary.recent_collections.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs">{c.payment_mode}</p>
                          <p className="text-xs text-gray-400">{fmtDateTime(c.collected_at)}</p>
                        </div>
                        <p className="font-medium text-green-700 text-xs">{fmt(c.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customerSummary.active_loans.length === 0 &&
               customerSummary.dues.length === 0 &&
               customerSummary.recent_collections.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No history for this customer</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approvingId} onOpenChange={open => { if (!open) setApprovingId(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogTitle>Approve Loan Request</DialogTitle>
          <DialogDescription className="text-sm">
            Loan will be auto-assigned to the requesting agent. All agents will be able to collect.
          </DialogDescription>
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setApprovingId(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={submittingApprove} className="flex-1">
              {submittingApprove
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Approving...</>
                : 'Confirm Approve'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={open => { if (!open) setRejectingId(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogTitle>Reject Loan Request</DialogTitle>
          <DialogDescription className="text-sm">
            Provide a reason for rejecting this loan request.
          </DialogDescription>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={submittingReject}
                variant="destructive"
                className="flex-1"
              >
                {submittingReject
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rejecting...</>
                  : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
