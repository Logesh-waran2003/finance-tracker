'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  HandCoins,
  Send,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ActionButton } from '@/components/ui/action-button'
import { Bi } from '@/components/ui/bi'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { Money, type MoneyIntent } from '@/components/ui/money'
import { PageHeader } from '@/components/ui/page-header'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { StickyActionBar } from '@/components/ui/sticky-action-bar'
import { apiPost, useOnlineStatus } from '@/lib/api-client'
import { formatDate, toNumber } from '@/lib/format'
import { labels, t, type LabelKey } from '@/lib/i18n'

interface ReconRow {
  id: string
  date: string
  cash_collected: string
  cash_submitted: string
  /** GENERATED column: cash_collected − cash_submitted. Never written by us. */
  difference: string | null
  status: string
  notes: string | null
  verified_at: Date | string | null
  rejection_reason: string | null
}

/**
 * No local STATUS_COLOR map: <StatusBadge> is the single source of truth.
 *
 * THE SIGN. `difference` is a generated column defined as
 * `cash_collected - cash_submitted`, so a POSITIVE value means the agent
 * handed over LESS than they collected — a SHORTFALL. Passing it raw to
 * <Money intent="auto"> would paint a shortfall green, which is exactly
 * backwards on the one screen where the sign matters. Every difference on
 * this screen is therefore classified here, explicitly, and never by "auto".
 */
type DiffMeta = {
  icon: LucideIcon
  labelKey: LabelKey
  tone: string
  intent: Exclude<MoneyIntent, 'auto'>
}

function diffMeta(difference: number): DiffMeta {
  if (difference === 0) {
    return { icon: CheckCircle2, labelKey: 'amountsMatch', tone: 'text-success', intent: 'in' }
  }
  if (difference > 0) {
    // Collected more than handed over → cash is missing.
    return { icon: AlertTriangle, labelKey: 'shortfall', tone: 'text-danger', intent: 'out' }
  }
  // Handed over more than collected → extra cash to explain.
  return {
    icon: ArrowUpCircle,
    labelKey: 'excess',
    tone: 'text-warning-muted-foreground',
    intent: 'owed',
  }
}

export function ReconciliationClient({
  initial,
  todayCash,
  todaySubmitted,
}: {
  initial: ReconRow[]
  todayCash: number
  todaySubmitted: number
}) {
  const [rows, setRows] = useState<ReconRow[]>(initial)
  const [submittedToday, setSubmittedToday] = useState(todaySubmitted)
  const [saving, setSaving] = useState(false)
  const [noSignal, setNoSignal] = useState(false)
  const [form, setForm] = useState({
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    cash_submitted: String(Math.max(0, todayCash - todaySubmitted)),
    notes: '',
  })

  const online = useOnlineStatus()
  const pendingHandover = Math.max(0, todayCash - submittedToday)
  const typed = toNumber(form.cash_submitted || '0')
  /**
   * Same POLARITY as the generated column (positive = shortfall), but measured
   * against what is still OUTSTANDING rather than the whole day's collections.
   * Using `todayCash - typed` told an agent who had already handed everything
   * over that they were short by the full day's takings.
   */
  const liveDifference = pendingHandover - typed
  const live = diffMeta(liveDifference)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.cash_submitted || typed < 0) {
      toast.error(t('enterValidAmount').en)
      return
    }

    setSaving(true)
    setNoSignal(false)

    // `difference` is a GENERATED column — it is never sent.
    const res = await apiPost<ReconRow>('/api/reconciliation', {
      date: form.date,
      cash_submitted: typed,
      notes: form.notes || undefined,
    })

    if (!res.ok) {
      // Deliberately NOT queued offline. Handing over cash needs a live
      // confirmation from the server; a queued handover would tell the agent
      // the money was settled before anyone had accepted it.
      if (res.offline) setNoSignal(true)
      setSaving(false)
      return
    }

    const record = res.data
    setRows(prev => {
      const exists = prev.some(r => r.id === record.id)
      return exists ? prev.map(r => (r.id === record.id ? record : r)) : [record, ...prev]
    })
    setSubmittedToday(prev => prev + typed)
    toast.success(t('reconciliationSubmitted').en)
    setForm(f => ({ ...f, cash_submitted: '0', notes: '' }))
    setSaving(false)
  }

  // ------------------------------------------------------------ history list
  const columns: DataListColumn<ReconRow>[] = [
    {
      key: 'date',
      header: <Bi k="date" />,
      primary: true,
      cell: r => <span className="font-medium">{formatDate(r.date)}</span>,
    },
    {
      key: 'submitted',
      header: <Bi k="submittedAmount" />,
      align: 'right',
      cell: r => <Money value={r.cash_submitted} size="row" intent="in" />,
    },
    {
      key: 'collected',
      header: <Bi k="cashCollected" />,
      hideOnMobile: true,
      cell: r => <Money value={r.cash_collected} size="row" intent="neutral" />,
    },
    {
      key: 'difference',
      header: <Bi k="difference" />,
      hideOnMobile: true,
      cell: r => {
        const meta = diffMeta(toNumber(r.difference ?? '0'))
        return (
          <span className={`flex items-center gap-1.5 ${meta.tone}`}>
            <meta.icon aria-hidden="true" className="size-4 shrink-0" />
            <Bi k={meta.labelKey} className="text-sm" />
            {toNumber(r.difference ?? '0') !== 0 ? (
              <Money value={Math.abs(toNumber(r.difference ?? '0'))} size="row" intent={meta.intent} />
            ) : null}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      align: 'right',
      hideOnMobile: true,
      cell: r => (
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={r.status} />
          {r.rejection_reason ? (
            <p className="text-xs text-danger">{r.rejection_reason}</p>
          ) : null}
        </div>
      ),
    },
  ]

  const renderCard = (r: ReconRow) => {
    const diff = toNumber(r.difference ?? '0')
    const meta = diffMeta(diff)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate font-medium">{formatDate(r.date)}</p>
          <Money value={r.cash_submitted} size="row" intent="in" className="shrink-0" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={r.status} />
          <span className={`flex items-center gap-1.5 text-sm ${meta.tone}`}>
            <meta.icon aria-hidden="true" className="size-4 shrink-0" />
            <Bi k={meta.labelKey} />
            {diff !== 0 ? <Money value={Math.abs(diff)} size="row" intent={meta.intent} /> : null}
          </span>
        </div>
        {r.rejection_reason ? <p className="text-xs text-danger">{r.rejection_reason}</p> : null}
      </div>
    )
  }

  // ------------------------------------------------------------------- view
  return (
    /* The shell pads for the tab bar and <StickyActionBar> reserves its own
       height, so this page adds no bottom padding of its own. */
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader titleKey="cashReconciliation" />

      {!online ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-warning-muted px-3 py-2.5 text-warning-muted-foreground">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <Bi k="handoverNeedsInternet" className="block text-sm font-medium" />
            <Bi k="handoverNotQueued" className="block text-xs opacity-80" />
          </div>
        </div>
      ) : null}

      {/* THE question this screen answers, as the largest thing on it. */}
      <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded bg-warning-muted text-warning-muted-foreground">
            <HandCoins aria-hidden="true" className="size-3" />
          </span>
          <Bi k="pendingHandover" className="text-xs font-medium text-muted-foreground" />
        </div>
        <div className="mt-2">
          <Money
            value={pendingHandover}
            size="hero"
            intent={pendingHandover > 0 ? 'owed' : 'in'}
          />
        </div>
        {pendingHandover === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            <Bi k="nothingToHandOver" />
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={Banknote} labelKey="confirmedCash" value={todayCash} intent="neutral" />
        <StatTile
          icon={Send}
          labelKey="alreadySubmitted"
          value={submittedToday}
          intent="success"
        />
      </div>

      <form id="handover-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField labelKey="date" htmlFor="handover-date">
          <Input
            id="handover-date"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </FormField>

        <FormField
          labelKey="handoverAmount"
          required
          htmlFor="handover-amount"
          hint={
            <span className="flex items-center gap-1.5">
              <Bi k="pendingHandover" />
              <Money value={pendingHandover} size="caption" intent="owed" />
            </span>
          }
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-muted-foreground"
            >
              ₹
            </span>
            <Input
              id="handover-amount"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              placeholder="0"
              value={form.cash_submitted}
              onChange={e =>
                setForm(f => ({ ...f, cash_submitted: e.target.value.replace(/[^\d.]/g, '') }))
              }
              className="h-18 pl-11 text-3xl font-bold tabular md:h-16"
            />
          </div>
        </FormField>

        {/* The common case is "all of it" — it should not need typing. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={pendingHandover <= 0}
          onClick={() => setForm(f => ({ ...f, cash_submitted: String(pendingHandover) }))}
        >
          <HandCoins aria-hidden="true" />
          <Bi k="handOverEverything" />
        </Button>

        {/* Colour is never the only signal: icon + word + amount. */}
        <div
          className={`flex items-center gap-2 rounded-xl border border-border px-3 py-3 ${live.tone}`}
        >
          <live.icon aria-hidden="true" className="size-5 shrink-0" />
          <Bi k={live.labelKey} className="text-sm font-medium" />
          {liveDifference !== 0 ? (
            <Money
              value={Math.abs(liveDifference)}
              size="row"
              intent={live.intent}
              className="ml-auto"
            />
          ) : null}
        </div>

        <FormField labelKey="notesOptional" htmlFor="handover-notes">
          <Input
            id="handover-notes"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </FormField>

        {noSignal ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-danger-muted px-3 py-3 text-danger-muted-foreground">
            <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <Bi k="noSignalTryAgain" className="block text-sm font-medium" />
              <Bi k="handoverNeedsInternetHint" className="block text-xs opacity-80" />
            </div>
          </div>
        ) : null}

      </form>

      <h2 className="text-sm font-semibold text-muted-foreground">{labels.history.en}</h2>

      <DataList
        items={rows}
        getKey={r => r.id}
        columns={columns}
        renderCard={renderCard}
        empty={<EmptyState icon={ArrowLeftRight} titleKey="noReconciliationsYet" />}
      />

      {/* Last in document order so its in-flow spacer sits at the bottom of the
          page, not between the form and the history list. `form=` keeps it a
          real submit button for the form above. */}
      <StickyActionBar>
        <ActionButton
          icon={ArrowLeftRight}
          labelKey={saving ? 'handoverSubmitting' : 'submitCashHandover'}
          intent="primary"
          size="lg"
          loading={saving}
          disabled={!online}
          amount={typed > 0 ? typed : undefined}
          type="submit"
          form="handover-form"
        />
      </StickyActionBar>
    </div>
  )
}
