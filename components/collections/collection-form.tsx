'use client'

import { useState, useCallback } from 'react'
import { generateId } from '@/lib/utils/id'
import {
  Banknote,
  CheckCircle2,
  Clock,
  Landmark,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Receipt,
  ScrollText,
  Smartphone,
  TrendingUp,
  Wallet,
  WifiOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ActionButton } from '@/components/ui/action-button'
import { Bi } from '@/components/ui/bi'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { Money } from '@/components/ui/money'
import { PageHeader } from '@/components/ui/page-header'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { StickyActionBar } from '@/components/ui/sticky-action-bar'
import { apiGet, apiPatch, apiPost, useOnlineStatus } from '@/lib/api-client'
import { enqueue, useQueueCount } from '@/lib/offline-queue'
import { formatCount, formatDateTime, toNumber } from '@/lib/format'
import { labels, statusLabel, t, type LabelKey } from '@/lib/i18n'

interface Customer {
  id: string
  customer_code: string
  full_name: string
  outstanding_total: string
}

interface Due {
  id: string
  invoice_number: string | null
  outstanding_amount: string
  status: string
}

interface CollectionRow {
  id: string
  collection_number: string | null
  customer_name: string | null
  amount: string
  payment_mode: string
  status: string
  collected_at: string | null
  notes: string | null
  rejected_reason: string | null
  source?: 'loan' | 'freeform'
  /** True for a row held in the offline queue, not yet accepted by the server. */
  queued?: boolean
}

/**
 * No local STATUS_COLOR map lives here any more: <StatusBadge> is the single
 * source of truth for status → colour → icon → word.
 */

const PAYMENT_MODES: ReadonlyArray<{ value: string; icon: LucideIcon }> = [
  { value: 'CASH', icon: Banknote },
  { value: 'UPI', icon: Smartphone },
  { value: 'BANK_TRANSFER', icon: Landmark },
  { value: 'CHEQUE', icon: ScrollText },
  { value: 'OTHER', icon: MoreHorizontal },
]

type GpsFix = { lat: number; lng: number; accuracy: number }

/** en-CA gives YYYY-MM-DD, which is what <input type="date"> wants. */
const istDay = (value: string | Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(value))

export function CollectionForm({
  customers,
  initial,
}: {
  customers: Customer[]
  initial: CollectionRow[]
}) {
  const [rows, setRows] = useState<CollectionRow[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  /**
   * One key per dialog open, deliberately NOT per submit.
   *
   * It used to be generated inside handleSubmit, so an agent whose request
   * timed out and tapped Save again sent a NEW key and the server inserted a
   * SECOND collection for the same cash. Reusing it lets the DB unique
   * constraint collapse the retry via ON CONFLICT DO NOTHING.
   */
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateId())
  const [saving, setSaving] = useState(false)
  const [dues, setDues] = useState<Due[]>([])
  const [loadingDues, setLoadingDues] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    due_id: '',
    amount: '',
    payment_mode: 'CASH',
    payment_reference: '',
    notes: '',
  })
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [gpsState, setGpsState] = useState<'idle' | 'acquiring' | 'ready' | 'denied'>('idle')
  const [dateFilter, setDateFilter] = useState('')

  const online = useOnlineStatus()
  const queueCount = useQueueCount()

  // ---------------------------------------------------------------- summary
  const today = istDay(new Date())
  const todayRows = rows.filter(r => r.collected_at && istDay(r.collected_at) === today)
  const sum = (list: CollectionRow[]) => list.reduce((acc, r) => acc + toNumber(r.amount), 0)
  const todayTotal = sum(todayRows.filter(r => r.status === 'CONFIRMED' || r.status === 'PENDING'))
  const pendingTotal = sum(todayRows.filter(r => r.status === 'PENDING'))
  const cashPending = sum(
    todayRows.filter(r => r.status === 'CONFIRMED' && r.payment_mode === 'CASH'),
  )

  const filteredRows = dateFilter
    ? rows.filter(r => r.collected_at && istDay(r.collected_at) === dateFilter)
    : rows

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const outstanding = toNumber(selectedCustomer?.outstanding_total ?? '0')

  // ------------------------------------------------------------------ dues
  async function loadDues(customerId: string) {
    setLoadingDues(true)
    setDues([])
    // /api/admin/dues is requireAdmin(), so an agent got 403 here and the
    // `if (res.ok)` below hid it — the dropdown was permanently empty for the
    // exact user this screen exists for. /api/dues allows agents and does its
    // own ownership check.
    const res = await apiGet<Due[]>(`/api/dues?customer_id=${customerId}`)
    if (!res.ok) {
      setLoadingDues(false)
      return
    }
    setDues(res.data.filter(d => d.status === 'OPEN' || d.status === 'PARTIALLY_PAID'))
    setLoadingDues(false)
  }

  function openDialog() {
    setForm({
      customer_id: '',
      due_id: '',
      amount: '',
      payment_mode: 'CASH',
      payment_reference: '',
      notes: '',
    })
    setDues([])
    setGps(null)
    setGpsState('idle')
    setIdempotencyKey(generateId()) // new collection => new key
    setDialogOpen(true)
  }

  /**
   * Resolves the fix instead of only writing it to state.
   *
   * This previously returned Promise<void> and the caller read `gps` from its
   * own closure on the very next line — which is always the value from the
   * render that created the handler, i.e. null. Every collection ever recorded
   * stored gps_lat NULL while the UI reported "location captured".
   * `attendance-client.tsx` already had the correct shape.
   */
  const acquireGps = useCallback((): Promise<GpsFix | null> => {
    return new Promise(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsState('denied')
        resolve(null)
        return
      }
      setGpsState('acquiring')
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc: GpsFix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          setGps(loc) // state drives the UI badge only
          setGpsState('ready')
          resolve(loc) // the caller must use THIS
        },
        () => {
          setGpsState('denied')
          resolve(null)
        },
        { timeout: 8000, maximumAge: 30000 },
      )
    })
  }, [])

  // ---------------------------------------------------------------- submit
  async function handleSubmit() {
    if (!form.customer_id) {
      toast.error(t('customerRequired').en)
      return
    }
    if (!form.payment_mode) {
      toast.error(t('paymentModeRequired').en)
      return
    }
    if (!form.amount || toNumber(form.amount) <= 0) {
      toast.error(t('amountMustBePositive').en)
      return
    }

    // Freeform cap — with no due selected the amount cannot exceed outstanding.
    if (!form.due_id) {
      if (outstanding <= 0) {
        toast.error(t('noOutstandingBalance').en)
        return
      }
      if (toNumber(form.amount) > outstanding) {
        toast.error(t('amountExceedsOutstanding').en)
        return
      }
    }

    setSaving(true)
    const loc = await acquireGps()

    const payload = {
      ...form,
      due_id: form.due_id || null,
      amount: toNumber(form.amount),
      gps_lat: loc?.lat,
      gps_lng: loc?.lng,
      gps_accuracy: loc?.accuracy,
      idempotency_key: idempotencyKey,
    }

    const res = await apiPost<CollectionRow>('/api/collections', payload)

    if (!res.ok) {
      if (res.offline) {
        // No signal. The cash is real and standing in front of the agent, so
        // it is stored in IndexedDB with the SAME idempotency key and replayed
        // when the network returns. The key is what stops the replay from
        // inserting a second collection.
        await enqueue({
          id: generateId(),
          url: '/api/collections',
          method: 'POST',
          body: payload,
          idempotencyKey,
          createdAt: Date.now(),
          attempts: 0,
        })
        setRows(prev => [
          {
            id: `queued-${idempotencyKey}`,
            collection_number: null,
            customer_name: selectedCustomer?.full_name ?? null,
            amount: form.amount,
            payment_mode: form.payment_mode,
            status: 'PENDING',
            collected_at: new Date().toISOString(),
            notes: form.notes || null,
            rejected_reason: null,
            source: 'freeform',
            queued: true,
          },
          ...prev,
        ])
        toast.success(t('collectionQueuedOffline').en)
        setDialogOpen(false)
      }
      setSaving(false)
      return
    }

    setRows(prev => [
      { ...res.data, customer_name: selectedCustomer?.full_name ?? null },
      ...prev,
    ])
    toast.success(t('collectionRecorded').en)
    setDialogOpen(false)
    setSaving(false)
  }

  async function cancelCollection(id: string) {
    const res = await apiPatch<unknown>(`/api/admin/collections/${id}`, { action: 'cancel' })
    if (!res.ok) return
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status: 'CANCELLED' } : r)))
    toast.success(t('collectionCancelled').en)
  }

  // ------------------------------------------------------------ list pieces
  function RowStatus({ r }: { r: CollectionRow }) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {r.source === 'loan' ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-info-muted px-2.5 text-xs font-medium text-info-muted-foreground">
            <Receipt aria-hidden="true" className="size-3.5" />
            <Bi k="loanPayment" />
          </span>
        ) : null}
        {r.queued ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
            <WifiOff aria-hidden="true" className="size-3.5" />
            <Bi k="queued" />
          </span>
        ) : (
          <StatusBadge status={r.status} />
        )}
      </div>
    )
  }

  const columns: DataListColumn<CollectionRow>[] = [
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: r => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.customer_name ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground tabular">
            {r.collection_number ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      align: 'right',
      cell: r => <Money value={r.amount} size="row" intent="in" />,
    },
    {
      key: 'mode',
      header: <Bi k="paymentMode" />,
      hideOnMobile: true,
      cell: r => <Bi label={statusLabel(r.payment_mode)} />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      align: 'right',
      hideOnMobile: true,
      cell: r => (
        <div className="flex flex-col items-end gap-1">
          <RowStatus r={r} />
          {r.rejected_reason ? (
            <p className="text-xs text-danger">{r.rejected_reason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'time',
      header: <Bi k="time" />,
      hideOnMobile: true,
      cell: r => (
        <span className="text-sm text-muted-foreground">
          {r.collected_at ? formatDateTime(r.collected_at) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: r =>
        r.status === 'PENDING' && r.source !== 'loan' && !r.queued ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => cancelCollection(r.id)}
          >
            <XCircle aria-hidden="true" />
            <Bi k="cancel" />
          </Button>
        ) : null,
    },
  ]

  const renderCard = (r: CollectionRow) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{r.customer_name ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground tabular">
            {r.collection_number ?? '—'}
          </p>
        </div>
        <Money value={r.amount} size="row" intent="in" className="shrink-0" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <RowStatus r={r} />
        <span className="text-xs text-muted-foreground">
          {r.collected_at ? formatDateTime(r.collected_at) : '—'}
        </span>
      </div>

      {r.notes && r.source === 'loan' ? (
        <p className="text-xs text-info">{r.notes}</p>
      ) : null}
      {r.rejected_reason ? <p className="text-xs text-danger">{r.rejected_reason}</p> : null}

      {r.status === 'PENDING' && r.source !== 'loan' && !r.queued ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-danger"
          onClick={() => cancelCollection(r.id)}
        >
          <XCircle aria-hidden="true" />
          <Bi k="cancelCollection" />
        </Button>
      ) : null}
    </div>
  )

  // ------------------------------------------------------------------ view
  const modeLabelKey = (mode: string): LabelKey | undefined =>
    mode === 'CASH'
      ? 'modeCash'
      : mode === 'UPI'
        ? 'modeUpi'
        : mode === 'BANK_TRANSFER'
          ? 'modeBankTransfer'
          : mode === 'CHEQUE'
            ? 'modeCheque'
            : mode === 'OTHER'
              ? 'modeOther'
              : undefined

  return (
    /* No extra bottom padding: the shell pads for the tab bar and
       <StickyActionBar> reserves its own height. */
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader titleKey="myCollections" />

      {!online ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-warning-muted px-3 py-2.5 text-warning-muted-foreground">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          <Bi k="offlineNow" className="text-sm font-medium" />
          <Bi k="offlineCollectionsNote" className="text-xs opacity-80" />
        </div>
      ) : null}

      {queueCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-info-muted px-3 py-2.5 text-info-muted-foreground">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          <span className="text-sm font-medium tabular">{formatCount(queueCount)}</span>
          <Bi k="pendingSync" className="text-sm" />
        </div>
      ) : null}

      {/* Numbers speak. Three tiles, no orphan hole: the third spans the row. */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={TrendingUp}
          labelKey="todaysTotal"
          value={todayTotal}
          intent="success"
        />
        <StatTile
          icon={Clock}
          labelKey="awaitingConfirmation"
          value={pendingTotal}
          intent="warning"
        />
        <StatTile
          icon={Wallet}
          labelKey="cashToHandOver"
          value={cashPending}
          intent="info"
          className="col-span-2"
        />
      </div>

      <FormField labelKey="filterByDate" htmlFor="collection-date-filter">
        <div className="flex items-center gap-2">
          <Input
            id="collection-date-filter"
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="flex-1"
          />
          {dateFilter ? (
            <Button variant="outline" size="lg" onClick={() => setDateFilter('')}>
              <Bi k="clear" />
            </Button>
          ) : null}
        </div>
        {dateFilter ? (
          <p className="text-xs text-muted-foreground">
            <span className="tabular">{formatCount(filteredRows.length)}</span>{' '}
            <Bi k="records" />
          </p>
        ) : null}
      </FormField>

      <DataList
        items={filteredRows}
        getKey={r => r.id}
        columns={columns}
        renderCard={renderCard}
        empty={
          <EmptyState
            icon={Wallet}
            titleKey={dateFilter ? 'noCollectionsForDate' : 'noCollectionsYet'}
            descriptionKey={dateFilter ? undefined : 'recordFirstCollection'}
          />
        }
      />

      {/* The one primary action, thumb-reachable. It is deliberately NOT
          repeated inside the empty state. */}
      <StickyActionBar>
        <ActionButton
          icon={Plus}
          labelKey="recordCollection"
          intent="success"
          size="lg"
          onClick={openDialog}
        />
      </StickyActionBar>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle>
            <Bi k="recordCollection" />
          </DialogTitle>

          <div className="flex flex-col gap-4">
            <FormField labelKey="customer" required htmlFor="collection-customer">
              <Select
                value={form.customer_id}
                onValueChange={(v: string | null) => {
                  const val = v || ''
                  setForm(f => ({ ...f, customer_id: val, due_id: '' }))
                  if (val) void loadDues(val)
                }}
              >
                <SelectTrigger id="collection-customer">
                  {/* The item children are rich nodes, so the trigger cannot
                      derive its text automatically — it showed the raw UUID.
                      Format it here instead. */}
                  <SelectValue>
                    {(v: string | null) =>
                      customers.find(c => c.id === v)?.full_name ?? labels.selectCustomer.en
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="truncate">{c.full_name}</span>
                        <Money value={c.outstanding_total} size="caption" intent="owed" />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {form.customer_id ? (
              <FormField labelKey="dueOptional" htmlFor="collection-due">
                {loadingDues ? (
                  <p className="flex h-14 items-center gap-2 text-sm text-muted-foreground md:h-11">
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    <Bi k="loadingDues" />
                  </p>
                ) : (
                  <Select
                    value={form.due_id || '_none'}
                    onValueChange={(v: string | null) => {
                      const val = v === '_none' ? '' : v || ''
                      const due = dues.find(d => d.id === val)
                      setForm(f => ({
                        ...f,
                        due_id: val,
                        amount: due
                          ? due.outstanding_amount
                          : outstanding > 0
                            ? String(outstanding)
                            : '',
                      }))
                    }}
                  >
                    <SelectTrigger id="collection-due">
                      <SelectValue>
                        {(v: string | null) => {
                          const due = dues.find(d => d.id === v)
                          if (!due) return labels.noneGeneralPayment.en
                          return due.invoice_number ?? labels.due.en
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">
                        <Bi k="noneGeneralPayment" />
                      </SelectItem>
                      {dues.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="truncate">
                              {d.invoice_number ?? labels.refNo.en}
                            </span>
                            <Money value={d.outstanding_amount} size="caption" intent="owed" />
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            ) : null}

            {/* THE hero field. Large tabular digits, decimal keypad, ₹ prefix. */}
            <FormField
              labelKey="amount"
              required
              htmlFor="collection-amount"
              hint={
                form.customer_id && !form.due_id ? (
                  outstanding > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Bi k="outstanding" />
                      <Money value={selectedCustomer?.outstanding_total ?? '0'} size="caption" intent="owed" />
                    </span>
                  ) : (
                    <Bi k="noOutstandingBalance" />
                  )
                ) : null
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
                  id="collection-amount"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder="0"
                  value={form.amount}
                  onChange={e =>
                    setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))
                  }
                  className="h-18 pl-11 text-3xl font-bold tabular md:h-16"
                />
              </div>
            </FormField>

            {/* Payment mode: large tappable chips, never a dropdown. */}
            <FormField labelKey="paymentMode" required>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_MODES.map(({ value, icon: Icon }) => {
                  const active = form.payment_mode === value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm(f => ({ ...f, payment_mode: value }))}
                      className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      <Icon aria-hidden="true" className="size-6" />
                      <Bi k={modeLabelKey(value)} className="text-center leading-tight" />
                    </button>
                  )
                })}
              </div>
            </FormField>

            {form.payment_mode !== 'CASH' ? (
              <FormField labelKey="paymentReference" htmlFor="collection-reference">
                <Input
                  id="collection-reference"
                  value={form.payment_reference}
                  onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
                  placeholder={labels.referenceHint.en}
                />
              </FormField>
            ) : null}

            <FormField labelKey="notesOptional" htmlFor="collection-notes">
              <Input
                id="collection-notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </FormField>

            {/* Honest GPS status. Never blocks the submit. */}
            <div className="flex items-center gap-2 text-xs">
              {gpsState === 'idle' ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-4" />
                  <Bi k="gpsOnSubmit" />
                </span>
              ) : null}
              {gpsState === 'acquiring' ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  <Bi k="gpsAcquiring" />
                </span>
              ) : null}
              {gpsState === 'ready' ? (
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  <Bi k="gpsCaptured" />
                  {gps ? (
                    <span className="tabular opacity-80">±{Math.round(gps.accuracy)}m</span>
                  ) : null}
                </span>
              ) : null}
              {gpsState === 'denied' ? (
                <span className="flex items-center gap-1.5 text-warning-muted-foreground">
                  <XCircle aria-hidden="true" className="size-4" />
                  <Bi k="gpsDeniedStillSaves" />
                </span>
              ) : null}
            </div>
          </div>

          {/* The sheet is already anchored to the bottom of the screen, so the
              submit sits in normal flow — no second sticky bar. */}
          <div className="flex flex-col gap-2 pt-1 md:flex-row-reverse">
            <ActionButton
              icon={Plus}
              labelKey={saving ? 'recording' : 'recordCollection'}
              intent="success"
              size="lg"
              loading={saving}
              onClick={handleSubmit}
            />
            <Button variant="outline" size="lg" onClick={() => setDialogOpen(false)}>
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
