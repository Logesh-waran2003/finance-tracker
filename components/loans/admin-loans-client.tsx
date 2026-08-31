'use client'

/**
 * Admin loan book.
 *
 * An admin often opens this from a phone between visits, so the list is a
 * <DataList>: cards on a phone, the full table from `md:`. Outstanding figures
 * are amber, never green — a balance the business is still owed is not a win.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Layers, Loader2, Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'

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
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/lib/api-client'
import { toNumber } from '@/lib/format'
import { labels, type LabelKey } from '@/lib/i18n'
import { fromCents, toCents } from '@/lib/utils/money'

export interface AdminLoanRow {
  id: string
  loan_number: string
  customer_name: string | null
  assigned_agent_name: string | null
  loan_amount: string
  disbursed_amount: string
  daily_installment: string
  principal_outstanding: string
  penalty_outstanding: string
  total_outstanding: string
  status: string
  disbursement_date: string
}

export interface AdminLoanCustomer {
  id: string
  full_name: string
  customer_code: string
}

export interface AdminLoanAgent {
  id: string
  full_name: string
  employee_code: string | null
}

interface Props {
  loans: AdminLoanRow[]
  customers: AdminLoanCustomer[]
  agents: AdminLoanAgent[]
}

interface FormState {
  customer_id: string
  agent_id: string
  loan_amount: string
  interest_pct: string
  tenure: string
  penalty_amount: string
  disbursement_date: string
  notes: string
}

const EMPTY_FORM: FormState = {
  customer_id: '',
  agent_id: '',
  loan_amount: '',
  interest_pct: '',
  tenure: '',
  penalty_amount: '0',
  disbursement_date: '',
  notes: '',
}

/**
 * The loan status filter. COMPLETED is not in the canonical status map — a
 * finished loan is fully repaid, which is what `statusPaid` says.
 */
const STATUS_OPTIONS: { value: string; labelKey: LabelKey }[] = [
  { value: 'ACTIVE', labelKey: 'statusActive' },
  { value: 'OVERDUE', labelKey: 'statusOverdue' },
  { value: 'COMPLETED', labelKey: 'statusPaid' },
  { value: 'CANCELLED', labelKey: 'statusCancelled' },
  { value: 'DRAFT', labelKey: 'statusDraft' },
]

export function AdminLoansClient({ loans: initialLoans, customers, agents }: Props) {
  const router = useRouter()
  const [loans, setLoans] = useState<AdminLoanRow[]>(initialLoans)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  // '' means "no filter". Base UI renders the raw value when a select has no
  // matching mounted item, so an "ALL" sentinel showed the word ALL in the
  // trigger; an empty value falls back to the placeholder instead.
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')

  // Totals in integer paise — no float arithmetic on money.
  const totalLoanAmount = fromCents(
    loans.reduce((sum, l) => sum + toCents(l.loan_amount || '0'), 0)
  )
  const totalPrincipalOs = fromCents(
    loans.reduce((sum, l) => sum + toCents(l.principal_outstanding || '0'), 0)
  )
  const activeLoans = loans.filter(
    (l) => l.status === 'ACTIVE' || l.status === 'OVERDUE'
  ).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const agentName = agents.find((a) => a.id === agentFilter)?.full_name
    return loans.filter((l) => {
      const matchesSearch =
        !q ||
        (l.customer_name ?? '').toLowerCase().includes(q) ||
        l.loan_number.toLowerCase().includes(q)
      const matchesStatus = !statusFilter || l.status === statusFilter
      const matchesAgent =
        !agentFilter || (agentName != null && l.assigned_agent_name === agentName)
      return matchesSearch && matchesStatus && matchesAgent
    })
  }, [loans, search, statusFilter, agentFilter, agents])

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function closeDialog() {
    setDialogOpen(false)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit() {
    if (!form.customer_id) {
      toast.error(labels.customerRequired.en)
      return
    }
    if (!form.loan_amount || !form.tenure || !form.disbursement_date) {
      toast.error(labels.loanAmountTenureDateRequired.en)
      return
    }
    if (toNumber(form.tenure) <= 0) {
      toast.error(labels.tenureMustBePositive.en)
      return
    }

    setSaving(true)
    const res = await apiPost<AdminLoanRow>('/api/admin/loans', {
      customer_id: form.customer_id,
      assigned_agent_id: form.agent_id || undefined,
      loan_amount: toNumber(form.loan_amount),
      interest_percentage: toNumber(form.interest_pct),
      tenure: Math.trunc(toNumber(form.tenure)),
      penalty_amount: toNumber(form.penalty_amount),
      disbursement_date: form.disbursement_date,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(labels.loanCreateFailed.en)
      return // the list is untouched
    }

    const customer = customers.find((c) => c.id === form.customer_id)
    const agent = agents.find((a) => a.id === form.agent_id)
    setLoans((prev) => [
      {
        ...res.data,
        customer_name: customer?.full_name ?? null,
        assigned_agent_name: agent?.full_name ?? null,
      },
      ...prev,
    ])
    closeDialog()
    toast.success(labels.loanCreated.en)
  }

  // Interest preview — display goes through <Money>, never a raw number.
  const loanAmountCents = toCents(form.loan_amount || '0')
  const interestCents = Math.round((loanAmountCents * toNumber(form.interest_pct)) / 100)
  const showInterestPreview = loanAmountCents > 0 && interestCents > 0
  const dailyPreview =
    loanAmountCents > 0 && toNumber(form.tenure) > 0
      ? fromCents(Math.round(loanAmountCents / toNumber(form.tenure)))
      : null

  const columns: DataListColumn<AdminLoanRow>[] = [
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{l.customer_name ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{l.loan_number}</p>
        </div>
      ),
    },
    {
      key: 'agent',
      header: <Bi k="agent" />,
      cell: (l) => (
        <span className="text-muted-foreground">{l.assigned_agent_name ?? '—'}</span>
      ),
    },
    {
      key: 'daily',
      header: <Bi k="dailyInstallment" />,
      cell: (l) => <Money value={l.daily_installment} size="caption" intent="neutral" />,
    },
    {
      key: 'principal',
      header: <Bi k="principalOutstanding" />,
      cell: (l) => <Money value={l.principal_outstanding} size="caption" intent="owed" />,
    },
    {
      key: 'penalty',
      header: <Bi k="penaltyOutstanding" />,
      hideOnMobile: true,
      cell: (l) => <Money value={l.penalty_outstanding} size="caption" intent="owed" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (l) => <StatusBadge status={l.status} />,
    },
    {
      key: 'amount',
      header: <Bi k="loanAmount" />,
      align: 'right',
      cell: (l) => <Money value={l.loan_amount} size="row" intent="neutral" />,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="loans"
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            <Bi k="createLoan" />
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Banknote}
          labelKey="totalLoanAmount"
          value={totalLoanAmount}
          intent="neutral"
          className="col-span-2"
          compact
        />
        <StatTile
          icon={Wallet}
          labelKey="outstanding"
          value={totalPrincipalOs}
          intent="warning"
          compact
        />
        <StatTile
          icon={Layers}
          labelKey="activeLoans"
          value={activeLoans}
          kind="count"
          intent="info"
          caption={`${loans.length} · ${labels.totalLoans.en}`}
        />
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
        <Input
          placeholder={labels.searchLoans.en}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:w-64"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => v !== null && setStatusFilter(v)}
        >
          <SelectTrigger className="md:w-44" aria-label={labels.status.en}>
            <SelectValue placeholder={labels.allStatuses.en} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{labels.allStatuses.en}</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {labels[option.labelKey].en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={(v) => v !== null && setAgentFilter(v)}>
          <SelectTrigger className="md:w-48" aria-label={labels.agent.en}>
            <SelectValue placeholder={labels.allAgents.en} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{labels.allAgents.en}</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataList
        items={filtered}
        getKey={(l) => l.id}
        columns={columns}
        onRowClick={(l) => router.push(`/admin/loans/${l.id}`)}
        empty={<EmptyState icon={Banknote} titleKey="noLoansFound" />}
      />

      {/* Create loan */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !saving) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="createLoan" />
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <FormField labelKey="customer" htmlFor="loan-customer" required>
              <Select
                value={form.customer_id}
                onValueChange={(v) => setField('customer_id', v ?? '')}
              >
                <SelectTrigger id="loan-customer">
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

            <FormField labelKey="assignedAgent" htmlFor="loan-agent">
              <Select
                value={form.agent_id}
                onValueChange={(v) => setField('agent_id', v ?? '')}
              >
                <SelectTrigger id="loan-agent">
                  <SelectValue placeholder={labels.selectAgent.en} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="loanAmount" htmlFor="loan-amount" required>
                <Input
                  id="loan-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.loan_amount}
                  onChange={(e) => setField('loan_amount', e.target.value)}
                />
              </FormField>

              <FormField
                labelKey="interestPercent"
                htmlFor="loan-interest"
                hint={
                  showInterestPreview ? (
                    <span className="flex flex-wrap items-center gap-1">
                      <Bi k="interest" />
                      <Money value={fromCents(interestCents)} size="caption" />
                      <span>·</span>
                      <Bi k="disbursedAmount" />
                      <Money
                        value={fromCents(loanAmountCents - interestCents)}
                        size="caption"
                      />
                    </span>
                  ) : undefined
                }
              >
                <Input
                  id="loan-interest"
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
                htmlFor="loan-tenure"
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
                  id="loan-tenure"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={form.tenure}
                  onChange={(e) => setField('tenure', e.target.value)}
                />
              </FormField>

              <FormField labelKey="penaltyAmount" htmlFor="loan-penalty">
                <Input
                  id="loan-penalty"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.penalty_amount}
                  onChange={(e) => setField('penalty_amount', e.target.value)}
                />
              </FormField>
            </div>

            <FormField labelKey="disbursementDate" htmlFor="loan-date" required>
              <Input
                id="loan-date"
                type="date"
                value={form.disbursement_date}
                onChange={(e) => setField('disbursement_date', e.target.value)}
              />
            </FormField>

            <FormField labelKey="notesOptional" htmlFor="loan-notes">
              <Textarea
                id="loan-notes"
                rows={2}
                className="resize-none"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" disabled={saving} onClick={closeDialog}>
              <Bi k="cancel" />
            </Button>
            <Button size="lg" disabled={saving} onClick={handleSubmit}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              <Bi k={saving ? 'saving' : 'createLoan'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
