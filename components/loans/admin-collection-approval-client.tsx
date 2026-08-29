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

interface PendingPayment {
  id: string
  payment_number: string
  loan_number: string
  customer_name: string
  agent_name: string
  amount: string
  payment_mode: string
  scheduled_date: string
  collected_at: string | null
}

interface Props {
  initial: PendingPayment[]
}

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
  return new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminCollectionApprovalClient({ initial }: Props) {
  const [payments, setPayments] = useState<PendingPayment[]>(initial)

  const [approveId, setApproveId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    if (!approveId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/loans/payments/${approveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to approve'); return }
      toast.success('Payment approved')
      setPayments(prev => prev.filter(p => p.id !== approveId))
      setApproveId(null)
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  async function handleReject() {
    if (!rejectId || !rejectReason.trim()) { toast.error('Reason is required'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/loans/payments/${rejectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to reject'); return }
      toast.success('Payment rejected — agent can re-collect')
      setPayments(prev => prev.filter(p => p.id !== rejectId))
      setRejectId(null)
      setRejectReason('')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  return (
    <>
      <div className="px-4 py-5 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Collection Approval</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {payments.length > 0
              ? `${payments.length} loan payment${payments.length !== 1 ? 's' : ''} awaiting approval`
              : 'No pending loan payments'}
          </p>
        </div>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400 text-sm">
              All caught up — no payments pending approval
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map(p => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Top: loan + payment number */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-400">{p.payment_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                      Awaiting Approval
                    </span>
                  </div>

                  {/* Customer + loan */}
                  <div>
                    <p className="font-semibold text-base leading-tight">{p.customer_name}</p>
                    <p className="text-xs text-gray-400">{p.loan_number}</p>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block">Amount</span>
                      <span className="font-medium">{fmt(p.amount)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Mode</span>
                      <span>{p.payment_mode}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Schedule Date</span>
                      <span>{fmtDate(p.scheduled_date)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Collected At</span>
                      <span>{fmtDateTime(p.collected_at)}</span>
                    </div>
                  </div>

                  {/* Footer: agent + action buttons */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
                    <p className="text-xs text-gray-400 min-w-0 truncate">By {p.agent_name}</p>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setApproveId(p.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => { setRejectId(p.id); setRejectReason('') }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve dialog */}
      <Dialog open={!!approveId} onOpenChange={open => { if (!open) setApproveId(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogTitle>Approve Payment</DialogTitle>
          <DialogDescription className="text-sm">
            This will mark the schedule as paid and update the loan balance.
          </DialogDescription>
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleApprove} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Approving...</> : 'Confirm Approve'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={open => { if (!open) { setRejectId(null); setRejectReason('') } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogTitle>Reject Payment</DialogTitle>
          <DialogDescription className="text-sm">
            The agent will be able to re-collect once rejected.
          </DialogDescription>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Reason *</Label>
              <Textarea
                rows={3}
                placeholder="Why is this payment being rejected?"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="resize-none text-sm"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setRejectId(null); setRejectReason('') }}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rejecting...</> : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
