'use client'

/**
 * Loan request queue.
 *
 * On a phone this is a stack of cards: the amount on the right, the customer
 * as the headline, a status badge, and the two full-width action buttons at
 * the bottom. Approve and reject come from `approval-actions.tsx` so this
 * screen, the collection approval queue and the loan detail payments tab
 * behave identically.
 */

import { useState } from 'react'
import { FileText, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'

import {
  ApprovalActions,
  ApproveDialog,
  RejectDialog,
} from '@/components/loans/approval-actions'
import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Money } from '@/components/ui/money'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGet, apiPatch } from '@/lib/api-client'
import { formatDate, formatDateTime, formatPercent, toNumber } from '@/lib/format'
import { labels, type LabelKey } from '@/lib/i18n'

export interface LoanRequestRow {
  id: string
  request_number: string
  status: string
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

export interface LoanRequestAgent {
  id: string
  full_name: string
  employee_code: string | null
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

interface Props {
  initial: LoanRequestRow[]
  agents: LoanRequestAgent[]
}

const FILTERS: { value: string; labelKey: LabelKey }[] = [
  { value: 'ALL', labelKey: 'filterAll' },
  { value: 'PENDING', labelKey: 'statusPending' },
  { value: 'APPROVED', labelKey: 'statusApproved' },
  { value: 'REJECTED', labelKey: 'statusRejected' },
]

function requestHeadline(req: LoanRequestRow): string {
  return req.customer_name ?? req.new_customer_name ?? '—'
}

export default function AdminLoanRequestsClient({ initial }: Props) {
  const [requests, setRequests] = useState<LoanRequestRow[]>(initial)
  const [filter, setFilter] = useState('ALL')

  const [approving, setApproving] = useState<LoanRequestRow | null>(null)
  const [rejecting, setRejecting] = useState<LoanRequestRow | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [loadingCustomer, setLoadingCustomer] = useState(false)

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length
  const filtered = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter)

  async function openCustomer(id: string) {
    setCustomerId(id)
    setSummary(null)
    setLoadingCustomer(true)
    const res = await apiGet<CustomerSummary>(`/api/admin/customers/${id}/summary`)
    setLoadingCustomer(false)
    if (!res.ok) {
      toast.error(labels.customerLoadFailed.en)
      return
    }
    setSummary(res.data)
  }

  async function handleApprove() {
    if (!approving) return
    const target = approving
    setBusy(true)
    const res = await apiPatch<{ loan_id?: string }>(
      `/api/admin/loan-requests/${target.id}`,
      { action: 'approve' }
    )
    setBusy(false)
    if (!res.ok) {
      // The row keeps its previous state: still PENDING, still actionable.
      toast.error(labels.approvalFailed.en)
      return
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? { ...r, status: 'APPROVED', created_loan_id: res.data?.loan_id ?? r.created_loan_id }
          : r
      )
    )
    setApproving(null)
    toast.success(labels.loanRequestApproved.en)
  }

  async function handleReject() {
    if (!rejecting || !reason.trim()) return
    const target = rejecting
    const text = reason.trim()
    setBusy(true)
    const res = await apiPatch<unknown>(`/api/admin/loan-requests/${target.id}`, {
      action: 'reject',
      rejection_reason: text,
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(labels.rejectionFailed.en)
      return
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === target.id ? { ...r, status: 'REJECTED', rejection_reason: text } : r
      )
    )
    setRejecting(null)
    setReason('')
    toast.success(labels.loanRequestRejected.en)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titleKey="loanRequests" subtitle={labels.reviewAgentLoanRequests.en} />

      {/* Filter tabs — 44px minimum, never a dropdown */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'ghost'}
            size="sm"
            className="min-w-0 px-1 text-xs md:text-sm"
            onClick={() => setFilter(f.value)}
          >
            <span className="truncate">
              <Bi k={f.labelKey} />
              {f.value === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} titleKey="noLoanRequestsYet" />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((req) => (
            <li
              key={req.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{requestHeadline(req)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {req.request_number}
                    {req.customer_code ? ` · ${req.customer_code}` : ''}
                  </p>
                  {req.new_customer_phone ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {req.new_customer_phone}
                      {req.new_customer_area ? ` · ${req.new_customer_area}` : ''}
                    </p>
                  ) : null}
                </div>
                <Money
                  value={req.loan_amount}
                  size="row"
                  intent="neutral"
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={req.status} />
                {req.customer_id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCustomer(req.customer_id as string)}
                  >
                    <User />
                    <Bi k="viewCustomer" />
                  </Button>
                ) : null}
              </div>

              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    <Bi k="dailyInstallment" />
                  </dt>
                  <dd className="flex items-center gap-1">
                    <Money value={req.daily_installment} size="caption" intent="neutral" />
                    <span className="text-xs text-muted-foreground">
                      <Bi k="perDay" />
                    </span>
                  </dd>
                </div>
                {req.tenure ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">
                      <Bi k="tenure" />
                    </dt>
                    <dd className="tabular">
                      {req.tenure} <Bi k="daysUnit" />
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    <Bi k="interest" />
                  </dt>
                  <dd className="tabular">{formatPercent(req.interest_percentage)}</dd>
                </div>
                {toNumber(req.penalty_amount) > 0 ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">
                      <Bi k="penaltyAmount" />
                    </dt>
                    <dd>
                      <Money value={req.penalty_amount} size="caption" intent="owed" />
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    <Bi k="disbursementDate" />
                  </dt>
                  <dd>{formatDate(req.disbursement_date)}</dd>
                </div>
              </dl>

              {req.notes ? (
                <p className="text-sm text-muted-foreground">{req.notes}</p>
              ) : null}
              {req.rejection_reason ? (
                <p className="rounded-lg bg-danger-muted px-3 py-2 text-xs text-danger-muted-foreground">
                  <Bi k="rejectedReasonPrefix" />: {req.rejection_reason}
                </p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                <Bi k="requestedBy" /> {req.agent_name ?? '—'} · {formatDate(req.created_at)}
              </p>

              {req.status === 'PENDING' ? (
                <ApprovalActions
                  onApprove={() => setApproving(req)}
                  onReject={() => {
                    setRejecting(req)
                    setReason('')
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ApproveDialog
        open={approving !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setApproving(null)
        }}
        titleKey="approveLoanRequest"
        descriptionKey="approveLoanRequestHelp"
        amount={approving?.loan_amount ?? '0'}
        headline={approving ? requestHeadline(approving) : ''}
        meta={approving ? `${approving.request_number} · ${approving.agent_name ?? '—'}` : null}
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
        titleKey="rejectLoanRequest"
        descriptionKey="rejectLoanRequestHelp"
        fieldId="loan-request-reject-reason"
        amount={rejecting?.loan_amount ?? '0'}
        headline={rejecting ? requestHeadline(rejecting) : ''}
        meta={rejecting ? `${rejecting.request_number} · ${rejecting.agent_name ?? '—'}` : null}
        reason={reason}
        onReasonChange={setReason}
        loading={busy}
        onConfirm={handleReject}
      />

      {/* Customer history, read-only */}
      <Dialog
        open={customerId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCustomerId(null)
            setSummary(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="customerProfile" />
            </DialogTitle>
            <DialogDescription className="sr-only">
              <Bi k="customerProfile" />
            </DialogDescription>
          </DialogHeader>

          {loadingCustomer ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!loadingCustomer && summary ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-base font-semibold">{summary.customer.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.customer.customer_code}
                </p>
                {summary.customer.phone ? (
                  <p className="text-xs text-muted-foreground">{summary.customer.phone}</p>
                ) : null}
                {summary.customer.area || summary.customer.city ? (
                  <p className="text-xs text-muted-foreground">
                    {[summary.customer.area, summary.customer.city]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl bg-warning-muted p-3 text-warning-muted-foreground">
                <p className="text-xs font-medium">
                  <Bi k="totalOutstanding" />
                </p>
                <Money
                  value={summary.summary.total_outstanding}
                  size="stat"
                  intent="owed"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p>
                      <Bi k="dues" />
                    </p>
                    <Money
                      value={summary.summary.dues_outstanding}
                      size="caption"
                      intent="owed"
                    />
                  </div>
                  <div>
                    <p>
                      <Bi k="loans" />
                    </p>
                    <Money
                      value={summary.summary.loan_outstanding}
                      size="caption"
                      intent="owed"
                    />
                  </div>
                </div>
              </div>

              {summary.active_loans.length > 0 ? (
                <section>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    <Bi k="activeLoans" /> ({summary.summary.active_loan_count})
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {summary.active_loans.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs">{l.loan_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(l.disbursement_date)}
                          </p>
                        </div>
                        <Money value={l.total_outstanding} size="caption" intent="owed" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {summary.dues.length > 0 ? (
                <section>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    <Bi k="unpaidDues" />
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {summary.dues.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs">
                            {d.invoice_number ?? labels.invoiceNumber.en}
                          </p>
                          {d.due_date ? (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(d.due_date)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Money value={d.outstanding_amount} size="caption" intent="owed" />
                          <StatusBadge status={d.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {summary.recent_collections.length > 0 ? (
                <section>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    <Bi k="recentCollections" />
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {summary.recent_collections.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs">{c.payment_mode}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(c.collected_at)}
                          </p>
                        </div>
                        {/* Money that has come IN — the one place green is right. */}
                        <Money value={c.amount} size="caption" intent="in" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {summary.active_loans.length === 0 &&
              summary.dues.length === 0 &&
              summary.recent_collections.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  <Bi k="noHistoryForCustomer" />
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { AdminLoanRequestsClient }
