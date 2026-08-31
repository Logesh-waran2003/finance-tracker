'use client'

import { useState } from 'react'
import {
  Banknote,
  Bus,
  Coffee,
  Fuel,
  Landmark,
  Package,
  Phone,
  Plus,
  Receipt,
  ReceiptText,
  Smartphone,
  Trash2,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { ActionButton } from '@/components/ui/action-button'
import { StickyActionBar } from '@/components/ui/sticky-action-bar'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { Money } from '@/components/ui/money'
import { Bi } from '@/components/ui/bi'
import { cn } from '@/lib/utils'
import { apiDelete, apiPost, useOnlineStatus } from '@/lib/api-client'
import { formatDate, toNumber } from '@/lib/format'
import { statusLabel, t, type LabelKey } from '@/lib/i18n'

interface ExpenseRow {
  id: string
  category_name: string | null
  amount: string
  payment_mode: string
  description: string
  expense_date: string
  status: string
  rejection_reason: string | null
}

interface Category {
  id: string
  name: string
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const

const MODE_ICON: Record<string, LucideIcon> = {
  CASH: Banknote,
  UPI: Smartphone,
  BANK_TRANSFER: Landmark,
  CHEQUE: ReceiptText,
  OTHER: Wallet,
}

const MODE_LABEL_KEY: Record<string, LabelKey> = {
  CASH: 'modeCash',
  UPI: 'modeUpi',
  BANK_TRANSFER: 'modeBankTransfer',
  CHEQUE: 'modeCheque',
  OTHER: 'modeOther',
}

/**
 * Categories are rows in the database, so the icon is matched on the name
 * rather than on a fixed enum. An unknown category still gets an icon.
 */
function categoryIcon(name: string | null): LucideIcon {
  const key = (name ?? '').toLowerCase()
  if (/bus|travel|transport|auto|train|ticket/.test(key)) return Bus
  if (/fuel|petrol|diesel|vehicle|bike/.test(key)) return Fuel
  if (/food|tea|coffee|snack|meal|refresh/.test(key)) return Coffee
  if (/phone|mobile|recharge|communicat|internet|data/.test(key)) return Phone
  if (/repair|maintenance|utilit|service|electric/.test(key)) return Wrench
  return Package
}

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

interface ChipProps {
  icon: LucideIcon
  label: React.ReactNode
  selected: boolean
  onSelect: () => void
}

/** Big tappable choice. Replaces a dropdown — one tap, no scroll list. */
function Chip({ icon: Icon, label, selected, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 min-w-0 flex-1 basis-[30%] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground'
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="line-clamp-2 leading-tight">{label}</span>
    </button>
  )
}

export function ExpensesClient({ initial, categories }: { initial: ExpenseRow[]; categories: Category[] }) {
  const [rows, setRows] = useState<ExpenseRow[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  // One key per dialog open, not per tap — a retry after a timeout must reuse
  // it or the server records the expense twice. Same contract as collections.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ExpenseRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const online = useOnlineStatus()
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    payment_mode: 'CASH',
    description: '',
    expense_date: istToday(),
  })

  const month = istToday().slice(0, 7)
  const monthRows = rows.filter(r => r.expense_date.slice(0, 7) === month)
  const sumBy = (status: string) =>
    monthRows.filter(r => r.status === status).reduce((s, r) => s + toNumber(r.amount), 0)

  function openDialog() {
    setForm({
      category_id: '',
      amount: '',
      payment_mode: 'CASH',
      description: '',
      expense_date: istToday(),
    })
    setFormError(null)
    setIdempotencyKey(crypto.randomUUID()) // new expense => new key
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!form.category_id) {
      setFormError(t('categoryRequired').en)
      return
    }
    if (!form.amount || toNumber(form.amount) <= 0) {
      setFormError(t('amountMustBePositive').en)
      return
    }
    if (!form.expense_date) {
      setFormError(t('requiredField').en)
      return
    }

    setSaving(true)
    setFormError(null)
    const res = await apiPost<ExpenseRow>('/api/expenses', {
      ...form,
      amount: toNumber(form.amount),
      idempotency_key: idempotencyKey,
    })
    if (!res.ok) {
      setFormError(res.error)
      setSaving(false)
      return
    }

    const cat = categories.find(c => c.id === form.category_id)
    setRows(prev => [{ ...res.data, category_name: cat?.name ?? null }, ...prev])
    toast.success(t('expenseSubmitted').en)
    setDialogOpen(false)
    setSaving(false)
  }

  /**
   * The API soft-deletes: it sets the expense to REJECTED with the note
   * "Deleted by employee" and writes an audit log. Nothing is removed from the
   * database, so the row stays visible with a Rejected badge.
   */
  async function confirmDelete() {
    const target = pendingDelete
    if (!target) return
    setDeleting(true)
    const res = await apiDelete(`/api/expenses/${target.id}`)
    if (!res.ok) {
      setDeleting(false)
      return
    }
    setRows(prev =>
      prev.map(r => (r.id === target.id ? { ...r, status: 'REJECTED', rejection_reason: null } : r))
    )
    toast.success(t('expenseWithdrawn').en)
    setDeleting(false)
    setPendingDelete(null)
  }

  const columns: DataListColumn<ExpenseRow>[] = [
    {
      key: 'category',
      header: <Bi k="category" />,
      primary: true,
      cell: row => <span className="font-medium">{row.category_name ?? t('none').en}</span>,
    },
    {
      key: 'date',
      header: <Bi k="date" />,
      cell: row => <span className="text-muted-foreground">{formatDate(row.expense_date)}</span>,
    },
    {
      key: 'description',
      header: <Bi k="description" />,
      cell: row => <span className="text-muted-foreground">{row.description}</span>,
    },
    {
      key: 'mode',
      header: <Bi k="paymentMode" />,
      cell: row => <Bi label={statusLabel(row.payment_mode)} className="text-muted-foreground" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: row => <StatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      align: 'right',
      cell: row => <Money value={row.amount} size="row" intent="out" />,
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: row =>
        row.status === 'PENDING' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('withdraw').en}
            className="text-danger"
            onClick={() => setPendingDelete(row)}
          >
            <Trash2 />
          </Button>
        ) : null,
    },
  ]

  const renderCard = (row: ExpenseRow) => {
    const Icon = categoryIcon(row.category_name)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.category_name ?? t('none').en}</p>
              <p className="text-xs text-muted-foreground">{formatDate(row.expense_date)}</p>
            </div>
          </div>
          <Money value={row.amount} size="row" intent="out" />
        </div>
        {row.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <StatusBadge status={row.status} />
            <Bi label={statusLabel(row.payment_mode)} className="truncate text-xs text-muted-foreground" />
          </div>
          {row.status === 'PENDING' ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('withdraw').en}
              className="text-danger"
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
        {row.rejection_reason ? (
          <p className="text-xs text-danger">{row.rejection_reason}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titleKey="officeExpenses" />

      {!online ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-warning-muted p-3 text-warning-muted-foreground">
          <Receipt aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 text-sm">
            <Bi k="offlineNow" className="font-semibold" />
            <p className="text-xs opacity-90">
              <Bi k="expensesNeedInternet" />
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <StatTile
          labelKey="statusApproved"
          value={sumBy('APPROVED')}
          intent="success"
          captionKey="thisMonth"
          compact
        />
        <StatTile
          labelKey="statusPending"
          value={sumBy('PENDING')}
          intent="warning"
          captionKey="thisMonth"
          compact
        />
        <StatTile
          labelKey="statusRejected"
          value={sumBy('REJECTED')}
          intent="danger"
          captionKey="thisMonth"
          compact
        />
      </div>

      <DataList
        items={rows}
        getKey={row => row.id}
        columns={columns}
        renderCard={renderCard}
        empty={
          <EmptyState icon={Receipt} titleKey="noExpensesYet" descriptionKey="noExpensesHelp" />
        }
      />

      <StickyActionBar>
        <ActionButton size="lg" icon={Plus} labelKey="addExpense" onClick={openDialog} />
      </StickyActionBar>

      {/* Add expense — bottom sheet on a phone. Amount is the hero field. */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            <Bi k="addExpense" />
          </DialogTitle>

          <FormField labelKey="amount" htmlFor="expense-amount" required error={formError}>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-muted-foreground"
              >
                ₹
              </span>
              <Input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                className="tabular h-16 pl-11 text-3xl font-bold md:h-16"
              />
            </div>
          </FormField>

          <FormField labelKey="category" required>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <Chip
                  key={c.id}
                  icon={categoryIcon(c.name)}
                  label={c.name}
                  selected={form.category_id === c.id}
                  onSelect={() => setForm(f => ({ ...f, category_id: c.id }))}
                />
              ))}
            </div>
          </FormField>

          <FormField labelKey="paymentMode">
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map(m => (
                <Chip
                  key={m}
                  icon={MODE_ICON[m]}
                  label={<Bi k={MODE_LABEL_KEY[m]} />}
                  selected={form.payment_mode === m}
                  onSelect={() => setForm(f => ({ ...f, payment_mode: m }))}
                />
              ))}
            </div>
          </FormField>

          <FormField labelKey="date" htmlFor="expense-date" required>
            <Input
              id="expense-date"
              type="date"
              value={form.expense_date}
              onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
            />
          </FormField>

          <FormField labelKey="notesOptional" htmlFor="expense-notes">
            <Input
              id="expense-notes"
              enterKeyHint="done"
              placeholder={t('expensePurposeHint').en}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </FormField>

          {/* Not a <StickyActionBar> — that bar is fixed to the viewport and
              sits below the sheet, so inside a dialog the button is inline. */}
          <ActionButton
            size="lg"
            icon={Plus}
            labelKey="submit"
            loading={saving}
            onClick={handleSubmit}
            className="shrink-0 md:w-full"
          />
        </DialogContent>
      </Dialog>

      {/* Withdraw confirmation — never window.confirm. */}
      <Dialog open={pendingDelete !== null} onOpenChange={open => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            <Bi k="withdrawExpense" />
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            <Bi k="withdrawExpenseBody" />
          </p>
          {pendingDelete ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <span className="min-w-0 truncate font-medium">
                {pendingDelete.category_name ?? t('none').en}
              </span>
              <Money value={pendingDelete.amount} size="row" intent="out" />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <ActionButton
              size="lg"
              intent="danger"
              icon={Trash2}
              labelKey="withdraw"
              loading={deleting}
              onClick={confirmDelete}
            />
            <Button variant="outline" size="lg" onClick={() => setPendingDelete(null)}>
              <Bi k="keepIt" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
