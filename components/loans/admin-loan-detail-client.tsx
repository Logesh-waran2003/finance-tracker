'use client'

/**
 * One loan, everything about it.
 *
 * The payments tab carries the same approve/reject interaction as the loan
 * request queue and the collection approval queue — it is imported from
 * `approval-actions.tsx` rather than rebuilt, because this screen is where the
 * three copies had drifted furthest apart.
 *
 * Colour rules on this screen:
 * - collected / confirmed money is green (`intent="in"`)
 * - anything still owed — principal, penalty, total outstanding — is amber
 *   (`intent="owed"`), never green
 * - the loan amount and the daily installment are facts, not outcomes, so they
 *   stay neutral
 */

import { useState } from 'react'
import {
  BadgeIndianRupee,
  CalendarDays,
  HandCoins,
  Loader2,
  TriangleAlert,
  Undo2,
  UserCog,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  ApprovalActions,
  ApproveDialog,
  RejectDialog,
} from '@/components/loans/approval-actions'
import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { apiPost, apiPatch } from '@/lib/api-client'
import { formatDate, formatDateTime, formatMoney, formatPercent, toNumber } from '@/lib/format'
import { labels, statusLabel } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoanDetail {
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

export interface LoanSchedule {
  id: string
  scheduled_date: string
  installment_amount: string
  status: string
  paid_at: string | null
  agent_name: string | null
  paid_amount: string | null
}

export interface LoanPayment {
  id: string
  payment_number: string
  scheduled_date: string
  payment_date: string
  amount: string
  payment_mode: string
  status: string
  rejected_reason: string | null
  is_reversed: boolean
  reversed_at: string | null
  agent_name: string | null
}

export interface LoanPenalty {
  id: string
  scheduled_date: string | null
  penalty_amount: string
  is_waived: boolean
  waived_amount: string | null
  waiver_reason: string | null
}

export interface LoanDetailAgent {
  id: string
  full_name: string
  employee_code: string | null
}

interface Props {
  loan: LoanDetail
  schedules: LoanSchedule[]
  payments: LoanPayment[]
  penalties: LoanPenalty[]
  agents: LoanDetailAgent[]
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const

interface BulkCollectResult {
  total_collected: string
  payments_created: number
  loan_status: string
  principal_outstanding: string
}

/**
 * A missed installment is not in the canonical status map and would render as
 * a grey unknown. OVERDUE means the same thing and is red.
 */
function scheduleBadgeStatus(status: string): string {
  return status?.toUpperCase() === 'MISSED' ? 'OVERDUE' : status
}

export function AdminLoanDetailClient({
  loan,
  schedules,
  payments: initialPayments,
  penalties: initialPenalties,
  agents,
}: Props) {
  const [currentLoan, setCurrentLoan] = useState<LoanDetail>(loan)
  const [payments, setPayments] = useState<LoanPayment[]>(initialPayments)
  const [penalties, setPenalties] = useState<LoanPenalty[]>(initialPenalties)

  // Approve / reject a collected payment
  const [approving, setApproving] = useState<LoanPayment | null>(null)
  const [rejecting, setRejecting] = useState<LoanPayment | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [paymentBusy, setPaymentBusy] = useState(false)

  // Reverse a confirmed payment
  const [reversing, setReversing] = useState<LoanPayment | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseBusy, setReverseBusy] = useState(false)

  // Waive a penalty
  const [waiving, setWaiving] = useState<LoanPenalty | null>(null)
  const [waiveAmount, setWaiveAmount] = useState('')
  const [waiveReason, setWaiveReason] = useState('')
  const [waiveBusy, setWaiveBusy] = useState(false)

  // Collect a lump sum against the loan
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkMode, setBulkMode] = useState<string>('CASH')
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  // Reassign the collecting agent
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignAgentId, setReassignAgentId] = useState('')
  const [reassignBusy, setReassignBusy] = useState(false)

  // -------------------------------------------------------------------------
  // Actions. Every failure path resets its own loading flag and leaves the row
  // exactly as it was — never half-updated.
  // -------------------------------------------------------------------------

  async function handleApprovePayment() {
    if (!approving) return
    const target = approving
    setPaymentBusy(true)
    const res = await apiPatch<unknown>(`/api/admin/loans/payments/${target.id}`, {
      action: 'confirm',
    })
    setPaymentBusy(false)
    if (!res.ok) {
      toast.error(labels.approvalFailed.en)
      return
    }
    setPayments((prev) =>
      prev.map((p) => (p.id === target.id ? { ...p, status: 'CONFIRMED' } : p))
    )
    setApproving(null)
    toast.success(labels.paymentApproved.en)
  }

  async function handleRejectPayment() {
    if (!rejecting || !rejectReason.trim()) return
    const target = rejecting
    const text = rejectReason.trim()
    setPaymentBusy(true)
    const res = await apiPatch<unknown>(`/api/admin/loans/payments/${target.id}`, {
      action: 'reject',
      reason: text,
    })
    setPaymentBusy(false)
    if (!res.ok) {
      toast.error(labels.rejectionFailed.en)
      return
    }
    setPayments((prev) =>
      prev.map((p) =>
        p.id === target.id ? { ...p, status: 'REJECTED', rejected_reason: text } : p
      )
    )
    setRejecting(null)
    setRejectReason('')
    toast.success(labels.paymentRejected.en)
  }

  async function handleReverse() {
    if (!reversing || !reverseReason.trim()) return
    const target = reversing
    setReverseBusy(true)
    const res = await apiPost<unknown>(`/api/admin/loans/${currentLoan.id}/reverse`, {
      payment_id: target.id,
      reason: reverseReason.trim(),
    })
    setReverseBusy(false)
    if (!res.ok) {
      toast.error(labels.reversalFailed.en)
      return
    }
    setPayments((prev) =>
      prev.map((p) =>
        p.id === target.id
          ? { ...p, is_reversed: true, reversed_at: new Date().toISOString() }
          : p
      )
    )
    setReversing(null)
    setReverseReason('')
    toast.success(labels.paymentReversed.en)
  }

  async function handleWaive() {
    if (!waiving || !waiveAmount || !waiveReason.trim()) return
    const target = waiving
    setWaiveBusy(true)
    const res = await apiPost<unknown>(`/api/admin/loans/${currentLoan.id}/waive`, {
      penalty_id: target.id,
      waived_amount: toNumber(waiveAmount),
      reason: waiveReason.trim(),
    })
    setWaiveBusy(false)
    if (!res.ok) {
      toast.error(labels.waiverFailed.en)
      return
    }
    setPenalties((prev) =>
      prev.map((p) =>
        p.id === target.id
          ? {
              ...p,
              is_waived: true,
              waived_amount: waiveAmount,
              waiver_reason: waiveReason.trim(),
            }
          : p
      )
    )
    setWaiving(null)
    setWaiveAmount('')
    setWaiveReason('')
    toast.success(labels.penaltyWaived.en)
  }

  async function handleBulkCollect() {
    const amount = toNumber(bulkAmount)
    if (amount <= 0) {
      toast.error(labels.enterValidAmount.en)
      return
    }
    setBulkBusy(true)
    const res = await apiPost<BulkCollectResult>(
      `/api/admin/loans/${currentLoan.id}/bulk-collect`,
      { amount, payment_mode: bulkMode, notes: bulkNotes || undefined }
    )
    setBulkBusy(false)
    if (!res.ok) {
      toast.error(labels.collectionFailed.en)
      return
    }
    setCurrentLoan((prev) => ({
      ...prev,
      principal_outstanding: res.data.principal_outstanding,
      status: res.data.loan_status,
    }))
    setBulkOpen(false)
    setBulkAmount('')
    setBulkNotes('')
    toast.success(
      `${labels.cashCollectionRecorded.en} · ${formatMoney(res.data.total_collected)}`
    )
  }

  async function handleReassign() {
    if (!reassignAgentId) return
    setReassignBusy(true)
    const res = await apiPost<unknown>(`/api/admin/loans/${currentLoan.id}/reassign`, {
      agent_id: reassignAgentId,
    })
    setReassignBusy(false)
    if (!res.ok) {
      toast.error(labels.reassignFailed.en)
      return
    }
    const agent = agents.find((a) => a.id === reassignAgentId)
    setCurrentLoan((prev) => ({
      ...prev,
      assigned_agent_name: agent?.full_name ?? prev.assigned_agent_name,
    }))
    setReassignOpen(false)
    setReassignAgentId('')
    toast.success(labels.agentReassigned.en)
  }

  // -------------------------------------------------------------------------
  // Lists
  // -------------------------------------------------------------------------

  const scheduleColumns: DataListColumn<LoanSchedule>[] = [
    {
      key: 'date',
      header: <Bi k="date" />,
      primary: true,
      cell: (s) => <span className="font-medium">{formatDate(s.scheduled_date)}</span>,
    },
    {
      key: 'paid',
      header: <Bi k="paidAmount" />,
      cell: (s) =>
        s.paid_amount ? (
          <Money value={s.paid_amount} size="caption" intent="in" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'agent',
      header: <Bi k="agent" />,
      cell: (s) => <span className="text-muted-foreground">{s.agent_name ?? '—'}</span>,
    },
    {
      key: 'paidAt',
      header: <Bi k="paidAt" />,
      hideOnMobile: true,
      cell: (s) => (s.paid_at ? formatDateTime(s.paid_at) : '—'),
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (s) => <StatusBadge status={scheduleBadgeStatus(s.status)} />,
    },
    {
      key: 'due',
      header: <Bi k="dueAmount" />,
      align: 'right',
      cell: (s) => <Money value={s.installment_amount} size="row" intent="owed" />,
    },
  ]

  const paymentColumns: DataListColumn<LoanPayment>[] = [
    {
      key: 'payment',
      header: <Bi k="paymentNumber" />,
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.payment_number}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDate(p.payment_date)}
          </p>
        </div>
      ),
    },
    {
      key: 'mode',
      header: <Bi k="paymentMode" />,
      cell: (p) => (
        <span className="text-muted-foreground">{statusLabel(p.payment_mode).en}</span>
      ),
    },
    {
      key: 'agent',
      header: <Bi k="agent" />,
      cell: (p) => <span className="text-muted-foreground">{p.agent_name ?? '—'}</span>,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (p) => (
        <div className="flex flex-wrap items-center justify-end gap-1 md:justify-start">
          <StatusBadge status={p.status} />
          {p.is_reversed ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-danger-muted px-2.5 text-xs font-medium text-danger-muted-foreground">
              <Undo2 aria-hidden="true" className="size-3.5" />
              <Bi k="reversed" />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: (p) => renderPaymentActions(p),
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      align: 'right',
      cell: (p) => (
        <Money
          value={p.amount}
          size="row"
          intent={p.status === 'CONFIRMED' && !p.is_reversed ? 'in' : 'neutral'}
        />
      ),
    },
  ]

  function renderPaymentActions(p: LoanPayment) {
    if (p.is_reversed) return null
    if (p.status === 'PENDING') {
      return (
        <ApprovalActions
          onApprove={() => setApproving(p)}
          onReject={() => {
            setRejecting(p)
            setRejectReason('')
          }}
        />
      )
    }
    if (p.status === 'CONFIRMED') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setReversing(p)
            setReverseReason('')
          }}
        >
          <Undo2 />
          <Bi k="reverse" />
        </Button>
      )
    }
    return null
  }

  function renderPaymentCard(p: LoanPayment) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{p.payment_number}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDate(p.payment_date)} · {statusLabel(p.payment_mode).en}
            </p>
            <p className="truncate text-xs text-muted-foreground">{p.agent_name ?? '—'}</p>
          </div>
          <Money
            value={p.amount}
            size="row"
            intent={p.status === 'CONFIRMED' && !p.is_reversed ? 'in' : 'neutral'}
            className="shrink-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={p.status} />
          {p.is_reversed ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-danger-muted px-2.5 text-xs font-medium text-danger-muted-foreground">
              <Undo2 aria-hidden="true" className="size-3.5" />
              <Bi k="reversed" />
            </span>
          ) : null}
        </div>

        {p.rejected_reason ? (
          <p className="rounded-lg bg-danger-muted px-3 py-2 text-xs text-danger-muted-foreground">
            <Bi k="rejectedReasonPrefix" />: {p.rejected_reason}
          </p>
        ) : null}

        {renderPaymentActions(p)}
      </div>
    )
  }

  const penaltyColumns: DataListColumn<LoanPenalty>[] = [
    {
      key: 'date',
      header: <Bi k="date" />,
      primary: true,
      cell: (p) => <span className="font-medium">{formatDate(p.scheduled_date)}</span>,
    },
    {
      key: 'waived',
      header: <Bi k="waivedAmount" />,
      cell: (p) =>
        p.waived_amount ? (
          <Money value={p.waived_amount} size="caption" intent="neutral" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (p) => (
        <div className="flex items-center justify-end gap-2 md:justify-start">
          {p.is_waived ? (
            <StatusBadge status="APPROVED" />
          ) : (
            <span className="inline-flex h-7 items-center rounded-full bg-warning-muted px-2.5 text-xs font-medium text-warning-muted-foreground">
              <Bi k="outstanding" />
            </span>
          )}
          {!p.is_waived ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWaiving(p)
                setWaiveAmount(p.penalty_amount)
                setWaiveReason('')
              }}
            >
              <Bi k="waive" />
            </Button>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: <Bi k="penaltyAmount" />,
      align: 'right',
      cell: (p) => <Money value={p.penalty_amount} size="row" intent="owed" />,
    },
  ]

  const collectable = currentLoan.status === 'ACTIVE' || currentLoan.status === 'OVERDUE'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={{ en: currentLoan.loan_number }}
        back
        subtitle={currentLoan.customer_name}
        action={
          collectable ? (
            <Button variant="success" onClick={() => setBulkOpen(true)}>
              <HandCoins />
              <Bi k="collectCash" />
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <StatusBadge status={currentLoan.status} />
        <span className="text-sm text-muted-foreground">
          {currentLoan.assigned_agent_name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Wallet}
          labelKey="totalOutstanding"
          value={currentLoan.total_outstanding}
          intent="warning"
          className="col-span-2"
        />
        <StatTile
          icon={BadgeIndianRupee}
          labelKey="principalCollected"
          value={currentLoan.principal_collected}
          intent="success"
        />
        <StatTile
          icon={Wallet}
          labelKey="principalOutstanding"
          value={currentLoan.principal_outstanding}
          intent="warning"
        />
        <StatTile
          icon={TriangleAlert}
          labelKey="penaltyOutstanding"
          value={currentLoan.penalty_outstanding}
          intent={toNumber(currentLoan.penalty_outstanding) > 0 ? 'danger' : 'neutral'}
        />
        <StatTile
          icon={CalendarDays}
          labelKey="dailyInstallment"
          value={currentLoan.daily_installment}
          intent="neutral"
        />
      </div>

      <Tabs defaultValue="schedule">
        {/* h-12 so each tab clears the 44px touch minimum: the trigger sizes
            itself to the list. */}
        <TabsList className="w-full group-data-horizontal/tabs:h-13">
          <TabsTrigger value="schedule">
            <Bi k="scheduleTab" />
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Bi k="paymentsTab" />
          </TabsTrigger>
          <TabsTrigger value="penalties">
            <Bi k="penaltiesTab" />
          </TabsTrigger>
          <TabsTrigger value="details">
            <Bi k="detailsTab" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <DataList
            items={schedules}
            getKey={(s) => s.id}
            columns={scheduleColumns}
            empty={<EmptyState icon={CalendarDays} titleKey="noScheduleEntries" />}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <DataList
            items={payments}
            getKey={(p) => p.id}
            columns={paymentColumns}
            renderCard={renderPaymentCard}
            empty={<EmptyState icon={HandCoins} titleKey="noPaymentsRecorded" />}
          />
        </TabsContent>

        <TabsContent value="penalties" className="mt-4">
          <DataList
            items={penalties}
            getKey={(p) => p.id}
            columns={penaltyColumns}
            empty={<EmptyState icon={TriangleAlert} titleKey="noPenalties" />}
          />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="customer" />
                </dt>
                <dd className="font-medium">{currentLoan.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="assignedAgent" />
                </dt>
                <dd className="font-medium">{currentLoan.assigned_agent_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="loanAmount" />
                </dt>
                <dd>
                  <Money value={currentLoan.loan_amount} size="row" intent="neutral" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="disbursedAmount" />
                </dt>
                <dd>
                  <Money value={currentLoan.disbursed_amount} size="row" intent="neutral" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="interest" />
                </dt>
                <dd className="flex items-center gap-2">
                  <span className="tabular">
                    {formatPercent(currentLoan.interest_percentage)}
                  </span>
                  <Money value={currentLoan.interest_amount} size="caption" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="penaltyPerMiss" />
                </dt>
                <dd>
                  <Money value={currentLoan.penalty_amount} size="row" intent="owed" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="disbursementDate" />
                </dt>
                <dd>{formatDate(currentLoan.disbursement_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  <Bi k="repaymentStartDate" />
                </dt>
                <dd>{formatDate(currentLoan.repayment_start_date)}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  <Bi k="notes" />
                </dt>
                <dd>{currentLoan.notes ?? '—'}</dd>
              </div>
            </dl>

            <Button variant="outline" onClick={() => setReassignOpen(true)}>
              <UserCog />
              <Bi k="reassignAgent" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* Approve / reject — identical to the other two queues               */}
      {/* ------------------------------------------------------------------ */}
      <ApproveDialog
        open={approving !== null}
        onOpenChange={(open) => {
          if (!open && !paymentBusy) setApproving(null)
        }}
        titleKey="approvePayment"
        descriptionKey="approvePaymentHelp"
        amount={approving?.amount ?? '0'}
        headline={currentLoan.customer_name}
        meta={approving ? `${currentLoan.loan_number} · ${approving.agent_name ?? '—'}` : null}
        loading={paymentBusy}
        onConfirm={handleApprovePayment}
      />

      <RejectDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open && !paymentBusy) {
            setRejecting(null)
            setRejectReason('')
          }
        }}
        titleKey="rejectPayment"
        descriptionKey="rejectPaymentHelp"
        fieldId="loan-detail-reject-reason"
        amount={rejecting?.amount ?? '0'}
        headline={currentLoan.customer_name}
        meta={rejecting ? `${currentLoan.loan_number} · ${rejecting.agent_name ?? '—'}` : null}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        loading={paymentBusy}
        onConfirm={handleRejectPayment}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Collect cash against the loan                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) setBulkOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="collectCashTitle" />
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">
              <Bi k="remainingPrincipal" />
            </p>
            <Money value={currentLoan.principal_outstanding} size="stat" intent="owed" />
          </div>

          <div className="flex flex-col gap-4">
            <FormField labelKey="amount" htmlFor="bulk-amount" required>
              <Input
                id="bulk-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
              />
            </FormField>

            <FormField labelKey="paymentMode" htmlFor="bulk-mode">
              <Select value={bulkMode} onValueChange={(v) => v !== null && setBulkMode(v)}>
                <SelectTrigger id="bulk-mode">
                  {/* Base UI renders the raw enum value unless the label is
                      resolved here, which showed "BANK_TRANSFER" to the user. */}
                  <SelectValue>{(v) => statusLabel(String(v)).en}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {statusLabel(m).en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField labelKey="notesOptional" htmlFor="bulk-notes">
              <Textarea
                id="bulk-notes"
                rows={2}
                className="resize-none"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={bulkBusy}
              onClick={() => setBulkOpen(false)}
            >
              <Bi k="cancel" />
            </Button>
            <Button
              variant="success"
              size="lg"
              disabled={bulkBusy || toNumber(bulkAmount) <= 0}
              onClick={handleBulkCollect}
            >
              {bulkBusy ? <Loader2 className="animate-spin" /> : <HandCoins />}
              <Bi k={bulkBusy ? 'saving' : 'confirmCollection'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Reverse a confirmed payment                                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={reversing !== null}
        onOpenChange={(open) => {
          if (!open && !reverseBusy) {
            setReversing(null)
            setReverseReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="reversePayment" />
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4">
            <Money value={reversing?.amount ?? '0'} size="stat" intent="neutral" />
            <p className="text-sm font-medium">{currentLoan.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              {reversing?.payment_number} · {reversing?.agent_name ?? '—'}
            </p>
          </div>

          <p className="text-sm text-warning-muted-foreground">
            <Bi k="moneyMovesWarning" />
          </p>

          <FormField
            labelKey="reason"
            htmlFor="reverse-reason"
            required
            hint={labels.reversalReasonHint.en}
          >
            <Textarea
              id="reverse-reason"
              rows={3}
              className="resize-none"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={reverseBusy}
              onClick={() => setReversing(null)}
            >
              <Bi k="cancel" />
            </Button>
            <Button
              variant="destructive"
              size="lg"
              disabled={reverseBusy || !reverseReason.trim()}
              onClick={handleReverse}
            >
              {reverseBusy ? <Loader2 className="animate-spin" /> : <Undo2 />}
              <Bi k={reverseBusy ? 'saving' : 'confirmReversal'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Waive a penalty                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={waiving !== null}
        onOpenChange={(open) => {
          if (!open && !waiveBusy) {
            setWaiving(null)
            setWaiveAmount('')
            setWaiveReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="waivePenalty" />
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">
              <Bi k="penaltyAmount" />
            </p>
            <Money value={waiving?.penalty_amount ?? '0'} size="stat" intent="owed" />
          </div>

          <div className="flex flex-col gap-4">
            <FormField labelKey="waivedAmount" htmlFor="waive-amount" required>
              <Input
                id="waive-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={waiveAmount}
                onChange={(e) => setWaiveAmount(e.target.value)}
              />
            </FormField>

            <FormField labelKey="reason" htmlFor="waive-reason" required>
              <Textarea
                id="waive-reason"
                rows={3}
                className="resize-none"
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={waiveBusy}
              onClick={() => setWaiving(null)}
            >
              <Bi k="cancel" />
            </Button>
            <Button
              size="lg"
              disabled={waiveBusy || !waiveAmount || !waiveReason.trim()}
              onClick={handleWaive}
            >
              {waiveBusy ? <Loader2 className="animate-spin" /> : null}
              <Bi k={waiveBusy ? 'saving' : 'confirmWaiver'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Reassign the collecting agent                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={reassignOpen}
        onOpenChange={(open) => {
          if (!open && !reassignBusy) setReassignOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="reassignAgent" />
            </DialogTitle>
          </DialogHeader>

          <FormField labelKey="assignedAgent" htmlFor="reassign-agent" required>
            <Select
              value={reassignAgentId}
              onValueChange={(v) => setReassignAgentId(v ?? '')}
            >
              <SelectTrigger id="reassign-agent">
                <SelectValue placeholder={labels.selectAgent.en} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                    {a.employee_code ? ` (${a.employee_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={reassignBusy}
              onClick={() => setReassignOpen(false)}
            >
              <Bi k="cancel" />
            </Button>
            <Button
              size="lg"
              disabled={reassignBusy || !reassignAgentId}
              onClick={handleReassign}
            >
              {reassignBusy ? <Loader2 className="animate-spin" /> : <UserCog />}
              <Bi k={reassignBusy ? 'saving' : 'confirmReassignment'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminLoanDetailClient
