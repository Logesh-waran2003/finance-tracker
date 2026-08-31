'use client'

/**
 * The agent's loan screen.
 *
 * The agent is standing in front of the customer, phone in one hand, outdoors.
 * The whole screen answers three questions in this order: how much is due
 * today, how much have I collected, who is overdue. Then one tap per customer.
 *
 * The one thing this screen must never do is let an agent believe money has
 * cleared when it has not. A loan payment is PENDING until an admin approves
 * it, so a collected row shows "Sent for approval — balance not updated yet"
 * and the outstanding figure does not move.
 */

import { useEffect, useMemo, useState } from 'react'
import { HandCoins, Loader2, TrendingUp, TriangleAlert, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import { ActionButton } from '@/components/ui/action-button'
import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { GMapsLink } from '@/components/ui/gmaps-link'
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
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiPost } from '@/lib/api-client'
import { toNumber } from '@/lib/format'
import { labels, statusLabel } from '@/lib/i18n'
import { fromCents, toCents } from '@/lib/utils/money'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'

const PAYMENT_MODES: PaymentMode[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']

export interface AgentLoan {
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
  status: string
  customer_name: string | null
  new_customer_name: string | null
  loan_amount: string
  daily_installment: string
  disbursement_date: string
  rejection_reason: string | null
  created_at: string | null
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

const EMPTY_REQUEST_FORM: RequestForm = {
  customer_id: '',
  new_customer_name: '',
  new_customer_phone: '',
  new_customer_area: '',
  loan_amount: '',
  interest_pct: '',
  tenure: '',
  penalty_amount: '0',
  disbursement_date: '',
  notes: '',
}

interface Props {
  loans: AgentLoan[]
  agentName: string
}

// ---------------------------------------------------------------------------
// Row state — one place that decides what today looks like for a loan
// ---------------------------------------------------------------------------

type RowState =
  | 'MISSED' // today's installment was not collected and the day is marked missed
  | 'DUE' // collectable right now
  | 'AWAITING' // collected, waiting for an admin to approve
  | 'COLLECTED' // approved, money has cleared
  | 'NONE' // nothing due today

function rowState(loan: AgentLoan): RowState {
  if (loan.today_payment_status === 'PENDING') return 'AWAITING'
  if (loan.today_payment_status === 'CONFIRMED') return 'COLLECTED'
  if (!loan.today_schedule_id) return 'NONE'
  const status = loan.today_schedule_status?.toUpperCase()
  if (status === 'MISSED') return 'MISSED'
  if (status === 'PAID') return 'COLLECTED'
  return 'DUE'
}

/**
 * The badge status string for a row.
 *
 * `MISSED` is not in the canonical status map, and an unknown status renders
 * grey — a missed installment shown grey reads like "nothing to do here".
 * OVERDUE carries the same meaning to the agent and is red, so a missed day
 * borrows it.
 */
function badgeStatus(state: RowState): string {
  switch (state) {
    case 'MISSED':
      return 'OVERDUE'
    case 'AWAITING':
      return 'PENDING'
    case 'COLLECTED':
      return 'PAID'
    default:
      return 'OPEN'
  }
}

const URGENCY: Record<RowState, number> = {
  MISSED: 0,
  DUE: 1,
  AWAITING: 2,
  COLLECTED: 3,
  NONE: 4,
}

// ---------------------------------------------------------------------------

export default function AgentLoansClient({ loans: initialLoans, agentName }: Props) {
  const [loans, setLoans] = useState<AgentLoan[]>(initialLoans)
  const [refreshing, setRefreshing] = useState(false)

  // Collect flow
  const [collectLoan, setCollectLoan] = useState<AgentLoan | null>(null)
  const [collectMode, setCollectMode] = useState<PaymentMode>('CASH')
  const [collecting, setCollecting] = useState(false)

  // Loan requests
  const [requests, setRequests] = useState<LoanRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [customers, setCustomers] = useState<AgentCustomer[]>([])
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestMode, setRequestMode] = useState<'existing' | 'new'>('existing')
  const [form, setForm] = useState<RequestForm>(EMPTY_REQUEST_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [reqRes, custRes] = await Promise.all([
        apiGet<LoanRequest[]>('/api/agent/loan-requests'),
        apiGet<AgentCustomer[]>('/api/customers'),
      ])
      if (cancelled) return
      if (reqRes.ok) setRequests(reqRes.data)
      if (custRes.ok) setCustomers(custRes.data)
      setLoadingRequests(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // -------------------------------------------------------------------------
  // Totals. toNumber is used for summing only — every displayed figure is the
  // original string handed straight to <Money>.
  // -------------------------------------------------------------------------

  const rows = useMemo(
    () =>
      [...loans].sort((a, b) => {
        const rank = URGENCY[rowState(a)] - URGENCY[rowState(b)]
        if (rank !== 0) return rank
        return a.customer_name.localeCompare(b.customer_name)
      }),
    [loans]
  )

  // Still to collect today: what is open, plus what was missed today. Both are
  // money the customer owes now, which is what "due today" has to mean.
  const dueTodayCents = loans
    .filter((l) => {
      const state = rowState(l)
      return state === 'DUE' || state === 'MISSED'
    })
    .reduce((sum, l) => sum + toCents(l.today_installment_amount ?? '0'), 0)

  const collectedTodayCents = loans
    .filter((l) => rowState(l) === 'COLLECTED')
    .reduce((sum, l) => sum + toCents(l.today_installment_amount ?? '0'), 0)

  const awaitingCount = loans.filter((l) => rowState(l) === 'AWAITING').length
  const overdueCount = loans.filter(
    (l) => rowState(l) === 'MISSED' || l.status === 'OVERDUE'
  ).length

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function handleRefresh() {
    setRefreshing(true)
    const res = await apiGet<AgentLoan[]>('/api/agent/loans')
    setRefreshing(false)
    if (!res.ok) return // the row keeps its previous state; a toast already showed
    setLoans(res.data)
  }

  async function handleCollect() {
    if (!collectLoan) return
    const target = collectLoan
    setCollecting(true)
    const res = await apiPost<unknown>(`/api/agent/loans/${target.id}/collect`, {
      payment_mode: collectMode,
    })
    setCollecting(false)
    if (!res.ok) {
      // Nothing changed on the row: the installment is still collectable.
      toast.error(labels.collectionFailed.en)
      return
    }
    setLoans((prev) =>
      prev.map((l) =>
        l.id === target.id ? { ...l, today_payment_status: 'PENDING' } : l
      )
    )
    setCollectLoan(null)
    setCollectMode('CASH')
    toast.success(labels.collectionSentForApproval.en)
  }

  function setField(key: keyof RequestForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function closeRequest() {
    setRequestOpen(false)
    setForm(EMPTY_REQUEST_FORM)
    setRequestMode('existing')
  }

  async function handleRequestSubmit() {
    if (!form.loan_amount || !form.tenure || !form.disbursement_date) {
      toast.error(labels.loanAmountTenureDateRequired.en)
      return
    }
    if (toNumber(form.tenure) <= 0) {
      toast.error(labels.tenureMustBePositive.en)
      return
    }
    if (requestMode === 'existing' && !form.customer_id) {
      toast.error(labels.customerRequired.en)
      return
    }
    if (requestMode === 'new' && !form.new_customer_name.trim()) {
      toast.error(labels.newCustomerNameRequired.en)
      return
    }

    const body: Record<string, unknown> = {
      loan_amount: toNumber(form.loan_amount),
      interest_percentage: toNumber(form.interest_pct),
      tenure: Math.trunc(toNumber(form.tenure)),
      penalty_amount: toNumber(form.penalty_amount),
      disbursement_date: form.disbursement_date,
      notes: form.notes || undefined,
    }
    if (requestMode === 'existing') {
      body.customer_id = form.customer_id
    } else {
      body.new_customer_name = form.new_customer_name
      body.new_customer_phone = form.new_customer_phone || undefined
      body.new_customer_area = form.new_customer_area || undefined
    }

    setSubmitting(true)
    const res = await apiPost<LoanRequest>('/api/agent/loan-requests', body)
    setSubmitting(false)
    if (!res.ok) {
      toast.error(labels.loanRequestFailed.en)
      return
    }
    setRequests((prev) => [res.data, ...prev])
    closeRequest()
    toast.success(labels.loanRequestSubmitted.en)
  }

  // -------------------------------------------------------------------------
  // Loan list
  // -------------------------------------------------------------------------

  const loanColumns: DataListColumn<AgentLoan>[] = [
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{l.customer_name}</p>
          <p className="truncate text-xs text-muted-foreground">{l.loan_number}</p>
        </div>
      ),
    },
    {
      key: 'outstanding',
      header: <Bi k="principalOutstanding" />,
      cell: (l) => <Money value={l.principal_outstanding} size="caption" intent="owed" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (l) => <StatusBadge status={badgeStatus(rowState(l))} />,
    },
    {
      key: 'today',
      header: <Bi k="todaysInstallment" />,
      align: 'right',
      cell: (l) =>
        l.today_installment_amount ? (
          <Money value={l.today_installment_amount} size="row" intent="owed" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'action',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: (l) =>
        rowState(l) === 'DUE' ? (
          <Button size="sm" onClick={() => setCollectLoan(l)}>
            <HandCoins />
            <Bi k="collect" />
          </Button>
        ) : null,
    },
  ]

  function renderLoanCard(loan: AgentLoan) {
    const state = rowState(loan)
    /**
     * Only an installment that is still PENDING for today can be collected:
     * `collectInstallment` rejects anything else with a 400. A MISSED day still
     * sorts to the top so the agent sees it, but showing a Collect button there
     * would be a button that always fails — an admin settles it with Collect
     * cash on the loan instead.
     */
    const collectable = state === 'DUE'

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{loan.customer_name}</p>
            <p className="truncate text-xs text-muted-foreground">{loan.loan_number}</p>
          </div>
          {loan.today_installment_amount ? (
            <Money
              value={loan.today_installment_amount}
              size="row"
              intent="owed"
              className="shrink-0"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={badgeStatus(state)} />
          <span className="text-xs text-muted-foreground">
            <Bi k="principalOutstanding" />
          </span>
          <Money value={loan.principal_outstanding} size="caption" intent="owed" />
        </div>

        {state === 'AWAITING' ? (
          <p className="rounded-lg bg-warning-muted px-3 py-2 text-xs font-medium text-warning-muted-foreground">
            <Bi k="awaitingApprovalRow" />
          </p>
        ) : null}

        {collectable && loan.today_installment_amount ? (
          <ActionButton
            icon={HandCoins}
            labelKey="collectInstallment"
            amount={loan.today_installment_amount}
            onClick={() => setCollectLoan(loan)}
            className="md:w-full md:min-w-0"
          />
        ) : null}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Loan requests list
  // -------------------------------------------------------------------------

  const requestColumns: DataListColumn<LoanRequest>[] = [
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {r.customer_name ?? r.new_customer_name ?? '—'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{r.request_number}</p>
        </div>
      ),
    },
    {
      key: 'daily',
      header: <Bi k="dailyInstallment" />,
      cell: (r) => (
        <span className="flex items-center gap-1">
          <Money value={r.daily_installment} size="caption" intent="neutral" />
          <span className="text-xs text-muted-foreground">
            <Bi k="perDay" />
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (r) => (
        <div className="flex flex-col items-end gap-1 md:items-start">
          <StatusBadge status={r.status} />
          {r.rejection_reason ? (
            <span className="text-xs text-danger">{r.rejection_reason}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: <Bi k="loanAmount" />,
      align: 'right',
      cell: (r) => <Money value={r.loan_amount} size="row" intent="neutral" />,
    },
  ]

  const dailyPreview =
    form.loan_amount && toNumber(form.tenure) > 0
      ? String(toNumber(form.loan_amount) / toNumber(form.tenure))
      : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="myLoans"
        subtitle={agentName}
        action={
          <Button onClick={() => setRequestOpen(true)}>
            <Bi k="requestLoan" />
          </Button>
        }
      />

      {/* KPI — how much is due, how much is in, who is behind */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Wallet}
          labelKey="dueToday"
          value={fromCents(dueTodayCents)}
          intent="warning"
          className="col-span-2"
        />
        <StatTile
          icon={TrendingUp}
          labelKey="collectedToday"
          value={fromCents(collectedTodayCents)}
          intent="success"
          caption={
            awaitingCount > 0 ? (
              <span className="text-warning-muted-foreground">
                {awaitingCount} · {labels.awaitingApproval.en}
              </span>
            ) : undefined
          }
        />
        <StatTile
          icon={TriangleAlert}
          labelKey="overdueLoans"
          value={overdueCount}
          kind="count"
          intent={overdueCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Loans, most urgent first */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            <Bi k="allMyLoans" />
          </h2>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" /> : null}
            <Bi k="refresh" />
          </Button>
        </div>
        <DataList
          items={rows}
          getKey={(l) => l.id}
          columns={loanColumns}
          renderCard={renderLoanCard}
          empty={
            <EmptyState
              icon={HandCoins}
              titleKey="noPendingCollectionsToday"
              descriptionKey="noLoansAssigned"
            />
          }
        />
      </section>

      {/* Requests the agent has raised */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          <Bi k="myLoanRequests" />
        </h2>
        <DataList
          items={requests}
          getKey={(r) => r.id}
          columns={requestColumns}
          loading={loadingRequests}
          skeletonRows={2}
          empty={<EmptyState titleKey="noLoanRequestsYet" />}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Collect — the amount is shown big BEFORE anything is submitted.     */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={collectLoan !== null}
        onOpenChange={(open) => {
          if (!open && !collecting) {
            setCollectLoan(null)
            setCollectMode('CASH')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="confirmCollectionAmount" />
            </DialogTitle>
            <DialogDescription>
              <Bi k="balanceUpdatesAfterApproval" />
            </DialogDescription>
          </DialogHeader>

          {collectLoan ? (
            <>
              <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4">
                <Money
                  value={collectLoan.today_installment_amount ?? '0'}
                  size="stat"
                  intent="neutral"
                />
                <p className="text-sm font-medium">{collectLoan.customer_name}</p>
                <p className="text-xs text-muted-foreground">{collectLoan.loan_number}</p>
              </div>

              <FormField labelKey="paymentMode" htmlFor="collect-mode">
                <Select
                  value={collectMode}
                  onValueChange={(v) => v !== null && setCollectMode(v as PaymentMode)}
                >
                  <SelectTrigger id="collect-mode">
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
            </>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={collecting}
              onClick={() => setCollectLoan(null)}
            >
              <Bi k="cancel" />
            </Button>
            <Button variant="success" size="lg" disabled={collecting} onClick={handleCollect}>
              {collecting ? <Loader2 className="animate-spin" /> : <HandCoins />}
              <Bi k={collecting ? 'saving' : 'confirm'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Request a new loan                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={requestOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) closeRequest()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="requestLoan" />
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={requestMode === 'existing' ? 'default' : 'outline'}
                onClick={() => setRequestMode('existing')}
              >
                <Bi k="existingCustomer" />
              </Button>
              <Button
                variant={requestMode === 'new' ? 'default' : 'outline'}
                onClick={() => setRequestMode('new')}
              >
                <Bi k="newCustomerOption" />
              </Button>
            </div>

            {requestMode === 'existing' ? (
              <FormField labelKey="customer" htmlFor="request-customer" required>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => setField('customer_id', v ?? '')}
                >
                  <SelectTrigger id="request-customer">
                    <SelectValue placeholder={labels.selectCustomer.en} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} ({c.customer_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
              <>
                <FormField labelKey="newCustomerName" htmlFor="request-name" required>
                  <Input
                    id="request-name"
                    value={form.new_customer_name}
                    onChange={(e) => setField('new_customer_name', e.target.value)}
                  />
                </FormField>
                <FormField labelKey="phone" htmlFor="request-phone">
                  <Input
                    id="request-phone"
                    type="tel"
                    value={form.new_customer_phone}
                    onChange={(e) => setField('new_customer_phone', e.target.value)}
                  />
                </FormField>
                <FormField
                  labelKey="area"
                  htmlFor="request-area"
                  hint={<GMapsLink query={form.new_customer_area} />}
                >
                  <Input
                    id="request-area"
                    value={form.new_customer_area}
                    onChange={(e) => setField('new_customer_area', e.target.value)}
                  />
                </FormField>
              </>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="loanAmount" htmlFor="request-amount" required>
                <Input
                  id="request-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.loan_amount}
                  onChange={(e) => setField('loan_amount', e.target.value)}
                />
              </FormField>
              <FormField labelKey="interestPercent" htmlFor="request-interest">
                <Input
                  id="request-interest"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.interest_pct}
                  onChange={(e) => setField('interest_pct', e.target.value)}
                />
              </FormField>
              <FormField
                labelKey="tenureDays"
                htmlFor="request-tenure"
                required
                hint={
                  dailyPreview ? (
                    <span className="flex items-center gap-1">
                      <Bi k="dailyInstallment" />
                      <Money value={dailyPreview} size="caption" decimals />
                    </span>
                  ) : undefined
                }
              >
                <Input
                  id="request-tenure"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={form.tenure}
                  onChange={(e) => setField('tenure', e.target.value)}
                />
              </FormField>
              <FormField labelKey="penaltyAmount" htmlFor="request-penalty">
                <Input
                  id="request-penalty"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.penalty_amount}
                  onChange={(e) => setField('penalty_amount', e.target.value)}
                />
              </FormField>
            </div>

            <FormField labelKey="disbursementDate" htmlFor="request-date" required>
              <Input
                id="request-date"
                type="date"
                value={form.disbursement_date}
                onChange={(e) => setField('disbursement_date', e.target.value)}
              />
            </FormField>

            <FormField labelKey="notesOptional" htmlFor="request-notes">
              <Textarea
                id="request-notes"
                rows={2}
                className="resize-none"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" disabled={submitting} onClick={closeRequest}>
              <Bi k="cancel" />
            </Button>
            <Button size="lg" disabled={submitting} onClick={handleRequestSubmit}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              <Bi k={submitting ? 'submitting' : 'submit'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { AgentLoansClient }
