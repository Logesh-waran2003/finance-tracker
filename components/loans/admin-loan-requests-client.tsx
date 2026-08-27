'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export default function AdminLoanRequestsClient({ initial, agents }: Props) {
  const [requests, setRequests] = useState<LoanRequestRow[]>(initial)
  const [filter, setFilter] = useState<FilterTab>('ALL')

  // Approve dialog state
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveAgentId, setApproveAgentId] = useState('')
  const [submittingApprove, setSubmittingApprove] = useState(false)

  // Reject dialog state
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [submittingReject, setSubmittingReject] = useState(false)

  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter)

  async function handleApprove() {
    if (!approveAgentId) { toast.error('Select an agent to assign'); return }
    setSubmittingApprove(true)
    try {
      const res = await fetch(`/api/admin/loan-requests/${approvingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', agent_id: approveAgentId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to approve'); return }
      toast.success('Loan request approved and loan created')
      setRequests(prev => prev.map(r =>
        r.id === approvingId ? { ...r, status: 'APPROVED', created_loan_id: data.loan_id ?? r.created_loan_id } : r
      ))
      setApprovingId(null)
      setApproveAgentId('')
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
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loan Requests</h1>
          <p className="text-gray-500">Review and action agent-submitted loan requests</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
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
            <CardContent className="py-10 text-center text-gray-400">
              No {filter !== 'ALL' ? filter.toLowerCase() : ''} loan requests
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => (
              <Card key={req.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{req.request_number}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[req.status])}>
                          {req.status}
                        </span>
                      </div>
                      <p className="font-semibold">{req.customer_name ?? req.new_customer_name ?? '—'}</p>
                      {req.customer_code && (
                        <p className="text-xs text-gray-400">{req.customer_code}</p>
                      )}
                      {req.new_customer_phone && (
                        <p className="text-xs text-gray-400">{req.new_customer_phone}{req.new_customer_area ? ` · ${req.new_customer_area}` : ''}</p>
                      )}
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p>{fmt(req.loan_amount)} loan · {req.tenure ? `${req.tenure} days` : ''} · {fmt(req.daily_installment)}/day · {parseFloat(req.interest_percentage)}% interest</p>
                        {parseFloat(req.penalty_amount) > 0 && (
                          <p className="text-xs text-gray-400">Penalty: {fmt(req.penalty_amount)}</p>
                        )}
                        <p className="text-xs text-gray-400">Disburse: {fmtDate(req.disbursement_date)}</p>
                      </div>
                      {req.notes && <p className="text-xs text-gray-500 italic">{req.notes}</p>}
                      {req.rejection_reason && (
                        <p className="text-xs text-red-500">Rejected: {req.rejection_reason}</p>
                      )}
                      <p className="text-xs text-gray-400">By {req.agent_name ?? '—'} · {fmtDate(req.created_at)}</p>
                    </div>

                    {req.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => { setApprovingId(req.id); setApproveAgentId('') }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
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

      {/* Approve dialog */}
      <Dialog open={!!approvingId} onOpenChange={open => { if (!open) setApprovingId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Approve Loan Request</DialogTitle>
          <DialogDescription>
            Select the agent to assign this loan to.
          </DialogDescription>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assign to Agent *</Label>
              <Select value={approveAgentId} onValueChange={v => setApproveAgentId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}{a.employee_code ? ` (${a.employee_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleApprove} disabled={submittingApprove} className="flex-1">
                {submittingApprove ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Approving...</> : 'Confirm Approve'}
              </Button>
              <Button variant="outline" onClick={() => setApprovingId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={open => { if (!open) setRejectingId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Reject Loan Request</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this loan request.
          </DialogDescription>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleReject}
                disabled={submittingReject}
                variant="destructive"
                className="flex-1"
              >
                {submittingReject ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rejecting...</> : 'Confirm Reject'}
              </Button>
              <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
