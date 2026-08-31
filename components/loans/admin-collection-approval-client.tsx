'use client'

/**
 * Loan payments waiting for an admin.
 *
 * Until a payment is approved the loan balance has not moved and the agent is
 * still carrying the cash, so this queue is the bottleneck of the whole loan
 * flow. It uses exactly the same approve/reject interaction as the loan
 * request queue and the loan detail payments tab — see `approval-actions.tsx`.
 */

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { toast } from 'sonner'

import {
  ApprovalActions,
  ApproveDialog,
  RejectDialog,
} from '@/components/loans/approval-actions'
import { Bi } from '@/components/ui/bi'
import { EmptyState } from '@/components/ui/empty-state'
import { Money } from '@/components/ui/money'
import { PageHeader } from '@/components/ui/page-header'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiPatch } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/lib/format'
import { labels, statusLabel } from '@/lib/i18n'
import { fromCents, toCents } from '@/lib/utils/money'

export interface PendingLoanPayment {
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
  initial: PendingLoanPayment[]
}

export default function AdminCollectionApprovalClient({ initial }: Props) {
  const [payments, setPayments] = useState<PendingLoanPayment[]>(initial)
  const [approving, setApproving] = useState<PendingLoanPayment | null>(null)
  const [rejecting, setRejecting] = useState<PendingLoanPayment | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Integer paise — the queue total must not drift on a float.
  const pendingValue = fromCents(
    payments.reduce((sum, p) => sum + toCents(p.amount || '0'), 0)
  )

  async function handleApprove() {
    if (!approving) return
    const target = approving
    setBusy(true)
    const res = await apiPatch<unknown>(`/api/admin/loans/payments/${target.id}`, {
      action: 'confirm',
    })
    setBusy(false)
    if (!res.ok) {
      // Still pending, still in the queue — nothing half-updated.
      toast.error(labels.approvalFailed.en)
      return
    }
    setPayments((prev) => prev.filter((p) => p.id !== target.id))
    setApproving(null)
    toast.success(labels.paymentApproved.en)
  }

  async function handleReject() {
    if (!rejecting || !reason.trim()) return
    const target = rejecting
    setBusy(true)
    const res = await apiPatch<unknown>(`/api/admin/loans/payments/${target.id}`, {
      action: 'reject',
      reason: reason.trim(),
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(labels.rejectionFailed.en)
      return
    }
    setPayments((prev) => prev.filter((p) => p.id !== target.id))
    setRejecting(null)
    setReason('')
    toast.success(labels.paymentRejected.en)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titleKey="collectionApproval" />

      <StatTile
        labelKey="pendingValue"
        value={pendingValue}
        intent="warning"
        caption={`${payments.length} · ${labels.awaitingApproval.en}`}
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          titleKey="noPendingItems"
          descriptionKey="queueAllClear"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{p.customer_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.loan_number} · {p.payment_number}
                  </p>
                </div>
                <Money value={p.amount} size="row" intent="neutral" className="shrink-0" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="PENDING" />
                <span className="text-xs text-muted-foreground">
                  {statusLabel(p.payment_mode).en}
                </span>
              </div>

              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    <Bi k="scheduleDate" />
                  </dt>
                  <dd>{formatDate(p.scheduled_date)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    <Bi k="collectedAtLabel" />
                  </dt>
                  <dd>{formatDateTime(p.collected_at)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    <Bi k="agent" />
                  </dt>
                  <dd className="truncate">{p.agent_name}</dd>
                </div>
              </dl>

              <ApprovalActions
                onApprove={() => setApproving(p)}
                onReject={() => {
                  setRejecting(p)
                  setReason('')
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <ApproveDialog
        open={approving !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setApproving(null)
        }}
        titleKey="approvePayment"
        descriptionKey="approvePaymentHelp"
        amount={approving?.amount ?? '0'}
        headline={approving?.customer_name ?? ''}
        meta={approving ? `${approving.loan_number} · ${approving.agent_name}` : null}
        loading={busy}
        onConfirm={handleApprove}
      />

      <RejectDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setRejecting(null)
            setReason('')
          }
        }}
        titleKey="rejectPayment"
        descriptionKey="rejectPaymentHelp"
        fieldId="loan-payment-reject-reason"
        amount={rejecting?.amount ?? '0'}
        headline={rejecting?.customer_name ?? ''}
        meta={rejecting ? `${rejecting.loan_number} · ${rejecting.agent_name}` : null}
        reason={reason}
        onReasonChange={setReason}
        loading={busy}
        onConfirm={handleReject}
      />
    </div>
  )
}

export { AdminCollectionApprovalClient }
