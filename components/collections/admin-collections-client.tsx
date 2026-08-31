'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Download, Inbox, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { apiGet, apiPatch } from '@/lib/api-client'
import { formatDate, formatDateTime, toNumber } from '@/lib/format'
import { statusLabel, t, type LabelKey } from '@/lib/i18n'

type CollectionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'
type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'

export interface AdminCollectionRow {
  id: string
  collection_number: string | null
  customer_id: string
  customer_name: string | null
  agent_id: string
  agent_name: string | null
  due_id: string | null
  amount: string
  payment_mode: PaymentMode
  payment_reference: string | null
  notes: string | null
  status: CollectionStatus
  rejected_reason: string | null
  confirmed_at: string | null
  collected_at: string | null
  created_at: string | null
}

interface Agent {
  id: string
  full_name: string
}

/** The subset the PATCH route echoes back. */
interface CollectionPatchResult {
  status?: CollectionStatus
  confirmed_at?: string | null
  rejected_reason?: string | null
}

const STATUS_FILTERS: { value: string; key: LabelKey }[] = [
  { value: 'ALL', key: 'allStatus' },
  { value: 'PENDING', key: 'statusPending' },
  { value: 'CONFIRMED', key: 'statusConfirmed' },
  { value: 'REJECTED', key: 'statusRejected' },
  { value: 'CANCELLED', key: 'statusCancelled' },
]

/**
 * A collection amount is only money that has actually arrived once it is
 * CONFIRMED. A pending row is a claim, not a receipt, so it stays neutral —
 * painting it green would tell the admin the cash is already in.
 *
 * A rejected row stays neutral too: red means "money out" here, and a rejected
 * collection is money that never arrived, not money that left. The red
 * <StatusBadge> already carries "rejected".
 */
function amountIntent(status: CollectionStatus): 'in' | 'neutral' {
  return status === 'CONFIRMED' ? 'in' : 'neutral'
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function exportCSV(rows: readonly AdminCollectionRow[]) {
  const headers = [
    'Number', 'Customer', 'Agent', 'Amount', 'Mode', 'Reference',
    'Status', 'Collected At', 'Confirmed At', 'Rejected Reason',
  ]
  const body = rows.map(r => [
    r.collection_number,
    r.customer_name,
    r.agent_name,
    r.amount,
    r.payment_mode,
    r.payment_reference,
    r.status,
    r.collected_at ? formatDateTime(r.collected_at) : '',
    r.confirmed_at ? formatDateTime(r.confirmed_at) : '',
    r.rejected_reason,
  ])
  const csv = [headers, ...body].map(row => row.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `collections-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminCollectionsClient({
  initial,
  agents,
}: {
  initial: AdminCollectionRow[]
  agents: Agent[]
}) {
  const [rows, setRows] = useState<AdminCollectionRow[]>(initial)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const [actioning, setActioning] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<AdminCollectionRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminCollectionRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const pendingRows = useMemo(() => rows.filter(r => r.status === 'PENDING'), [rows])
  const otherRows = useMemo(() => rows.filter(r => r.status !== 'PENDING'), [rows])

  const pendingValue = useMemo(
    () => pendingRows.reduce((sum, r) => sum + toNumber(r.amount), 0),
    [pendingRows],
  )

  const confirmedTodayValue = useMemo(() => {
    const today = formatDate(new Date())
    return rows
      .filter(r => r.status === 'CONFIRMED' && r.confirmed_at && formatDate(r.confirmed_at) === today)
      .reduce((sum, r) => sum + toNumber(r.amount), 0)
  }, [rows])

  async function fetchRows() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (agentFilter !== 'ALL') params.set('agent_id', agentFilter)
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    const res = await apiGet<AdminCollectionRow[]>(`/api/admin/collections?${params}`)
    setLoading(false)
    if (!res.ok) return
    setRows(res.data)
  }

  async function confirmCollection() {
    const target = confirmTarget
    if (!target) return
    setActioning(target.id)
    const res = await apiPatch<CollectionPatchResult>(
      `/api/admin/collections/${target.id}`,
      { action: 'confirm' },
    )
    setActioning(null)
    // Failure: the row keeps its previous state and the dialog stays open.
    if (!res.ok) return
    setRows(prev =>
      prev.map(r =>
        r.id === target.id
          ? { ...r, status: 'CONFIRMED', confirmed_at: res.data.confirmed_at ?? r.confirmed_at }
          : r,
      ),
    )
    setConfirmTarget(null)
    toast.success(t('collectionConfirmed').en)
  }

  async function rejectCollection() {
    const target = rejectTarget
    const reason = rejectReason.trim()
    if (!target || !reason) return
    setActioning(target.id)
    const res = await apiPatch<CollectionPatchResult>(
      `/api/admin/collections/${target.id}`,
      { action: 'reject', reason },
    )
    setActioning(null)
    // Failure: the typed reason stays in the open dialog.
    if (!res.ok) return
    setRows(prev =>
      prev.map(r =>
        r.id === target.id ? { ...r, status: 'REJECTED', rejected_reason: reason } : r,
      ),
    )
    setRejectTarget(null)
    setRejectReason('')
    toast.success(t('collectionRejected').en)
  }

  function openConfirm(row: AdminCollectionRow) {
    setConfirmTarget(row)
  }

  function openReject(row: AdminCollectionRow) {
    setRejectTarget(row)
    setRejectReason('')
  }

  function rowActions(row: AdminCollectionRow, layout: 'card' | 'row') {
    if (row.status !== 'PENDING') return null
    const busy = actioning === row.id
    return (
      <div className={layout === 'card' ? 'flex flex-col gap-2' : 'flex gap-2'}>
        <Button
          variant="success"
          size={layout === 'card' ? 'default' : 'sm'}
          disabled={busy}
          onClick={() => openConfirm(row)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          <Bi k="confirm" />
        </Button>
        <Button
          variant="destructive"
          size={layout === 'card' ? 'default' : 'sm'}
          disabled={busy}
          onClick={() => openReject(row)}
        >
          <XCircle />
          <Bi k="reject" />
        </Button>
      </div>
    )
  }

  const columns: DataListColumn<AdminCollectionRow>[] = [
    {
      key: 'number',
      header: <Bi k="refNo" />,
      cell: r => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.collection_number ?? '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: r => <span className="font-medium">{r.customer_name ?? '—'}</span>,
    },
    {
      key: 'agent',
      header: <Bi k="agent" />,
      cell: r => <span className="text-muted-foreground">{r.agent_name ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      align: 'right',
      cell: r => <Money value={r.amount} intent={amountIntent(r.status)} />,
    },
    {
      key: 'mode',
      header: <Bi k="paymentMode" />,
      cell: r => <Bi label={statusLabel(r.payment_mode)} className="text-muted-foreground" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: r => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={r.status} />
          {r.rejected_reason ? (
            <span className="max-w-40 truncate text-xs text-danger" title={r.rejected_reason}>
              {r.rejected_reason}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'collectedAt',
      header: <Bi k="collectedAt" />,
      cell: r => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {r.collected_at ? formatDateTime(r.collected_at) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: r => rowActions(r, 'row'),
    },
  ]

  const renderCard = (r: AdminCollectionRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.customer_name ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{r.agent_name ?? '—'}</p>
        </div>
        <Money value={r.amount} intent={amountIntent(r.status)} className="shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <Bi label={statusLabel(r.payment_mode)} className="text-xs text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {r.collected_at ? formatDateTime(r.collected_at) : '—'}
        </span>
      </div>
      {r.rejected_reason ? (
        <p className="text-xs text-danger">{r.rejected_reason}</p>
      ) : null}
      {rowActions(r, 'card')}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="collections"
        action={
          <Button variant="outline" onClick={() => exportCSV(rows)}>
            <Download />
            <Bi k="exportCsv" />
          </Button>
        }
      />

      {/* The three numbers the admin opens this screen for. */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <StatTile
          icon={Clock}
          labelKey="pendingCount"
          value={pendingRows.length}
          kind="count"
          intent="warning"
        />
        <StatTile
          icon={Inbox}
          labelKey="pendingValue"
          value={pendingValue}
          intent="warning"
          compact
        />
        <StatTile
          icon={CheckCircle2}
          labelKey="confirmedToday"
          value={confirmedTodayValue}
          intent="success"
          compact
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Pending queue — the main job. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          <Bi k="pendingQueue" />
        </h2>
        <DataList
          items={pendingRows}
          getKey={r => r.id}
          columns={columns}
          renderCard={renderCard}
          empty={
            <EmptyState
              icon={CheckCircle2}
              titleKey="noPendingItems"
              descriptionKey="queueAllClear"
            />
          }
        />
      </section>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField labelKey="status" htmlFor="col-status">
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'ALL')}>
                <SelectTrigger id="col-status">
                  <SelectValue>
                    <Bi
                      k={
                        STATUS_FILTERS.find(o => o.value === statusFilter)?.key ??
                        'allStatus'
                      }
                    />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      <Bi k={o.key} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField labelKey="agent" htmlFor="col-agent">
              <Select value={agentFilter} onValueChange={v => setAgentFilter(v ?? 'ALL')}>
                <SelectTrigger id="col-agent">
                  <SelectValue>
                    {agentFilter === 'ALL' ? (
                      <Bi k="allAgents" />
                    ) : (
                      (agents.find(a => a.id === agentFilter)?.full_name ?? '—')
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <Bi k="allAgents" />
                  </SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField labelKey="from" htmlFor="col-from">
              <Input
                id="col-from"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField labelKey="to" htmlFor="col-to">
              <Input
                id="col-to"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </FormField>
          </div>
          <Button onClick={fetchRows} disabled={loading} className="md:self-start">
            {loading ? <Loader2 className="animate-spin" /> : null}
            <Bi k="applyFilters" />
          </Button>
        </CardContent>
      </Card>

      {/* Everything already actioned. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          <Bi k="allRecords" />
        </h2>
        <DataList
          items={otherRows}
          getKey={r => r.id}
          columns={columns}
          renderCard={renderCard}
          empty={<EmptyState icon={Inbox} titleKey="noCollectionsFound" />}
        />
      </section>

      {/* Confirm — an approve moves real money, so the amount is shown large. */}
      <Dialog
        open={!!confirmTarget}
        onOpenChange={open => {
          if (!open && !actioning) setConfirmTarget(null)
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="confirmCollection" />
          </DialogTitle>
          <DialogDescription>
            <Bi k="moneyMovesWarning" />
          </DialogDescription>
          {confirmTarget ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-success-muted p-4 text-center">
              <span className="text-sm text-muted-foreground">
                {confirmTarget.customer_name ?? '—'}
              </span>
              <Money value={confirmTarget.amount} size="stat" intent="in" />
              <span className="text-xs text-muted-foreground">
                <Bi k="confirmThisAmount" />
              </span>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              variant="success"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={confirmCollection}
            >
              {actioning ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              <Bi k="confirm" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={() => setConfirmTarget(null)}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject — always captures a reason. */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={open => {
          if (!open && !actioning) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="rejectCollection" />
          </DialogTitle>
          {rejectTarget ? (
            <DialogDescription>
              {rejectTarget.customer_name ?? '—'}
            </DialogDescription>
          ) : null}
          {rejectTarget ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-muted p-4 text-center">
              <Money value={rejectTarget.amount} size="stat" />
            </div>
          ) : null}
          <FormField
            labelKey="rejectionReason"
            htmlFor="col-reject-reason"
            required
            hint={<Bi k="reasonVisibleToAgent" />}
          >
            <Textarea
              id="col-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('rejectReasonHint').en}
            />
          </FormField>
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              variant="destructive"
              size="lg"
              className="md:flex-1"
              disabled={!rejectReason.trim() || !!actioning}
              onClick={rejectCollection}
            >
              {actioning ? <Loader2 className="animate-spin" /> : <XCircle />}
              <Bi k="reject" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
