'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  Download,
  Inbox,
  Loader2,
  XCircle,
} from 'lucide-react'
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
import { formatDate, toNumber } from '@/lib/format'
import { t, type LabelKey } from '@/lib/i18n'

interface ReconRow {
  id: string
  agent_id: string
  agent_name: string | null
  date: string
  cash_collected: string
  cash_submitted: string
  /** GENERATED column: cash_collected - cash_submitted. Never written from here. */
  difference: string | null
  status: string
  notes: string | null
  verified_at: string | null
  rejection_reason: string | null
  created_at: string | null
}

interface Agent {
  id: string
  full_name: string
}

interface ReconPatchResult {
  status?: string
  rejection_reason?: string | null
  verified_at?: string | null
}

const STATUS_FILTERS: { value: string; key: LabelKey }[] = [
  { value: 'ALL', key: 'allStatus' },
  { value: 'PENDING', key: 'statusPending' },
  { value: 'SUBMITTED', key: 'statusSubmitted' },
  { value: 'VERIFIED', key: 'statusVerified' },
  { value: 'REJECTED', key: 'statusRejected' },
]

const ACTIONABLE = new Set(['SUBMITTED', 'PENDING'])

/**
 * `difference` is a GENERATED column: `cash_collected - cash_submitted`.
 *
 * So a POSITIVE difference means the agent collected MORE than they handed in
 * — that is a SHORTFALL, and it is the bad case. Passing the raw value to
 * `<Money intent="auto">` would paint it green, which is exactly backwards on
 * the one screen where the sign matters most. The sign is resolved here, once.
 */
type DiffKind = 'shortfall' | 'excess' | 'matched'

function diffKind(difference: string | null): DiffKind {
  const n = toNumber(difference ?? '0')
  if (n > 0) return 'shortfall'
  if (n < 0) return 'excess'
  return 'matched'
}

/** Magnitude as a string, so no precision is lost on the way to <Money>. */
function diffMagnitude(difference: string | null): string {
  const raw = (difference ?? '0').trim()
  return raw.startsWith('-') ? raw.slice(1) : raw
}

const DIFF_STYLE: Record<
  DiffKind,
  { labelKey: LabelKey; icon: typeof AlertTriangle; className: string }
> = {
  // Money the business is missing.
  shortfall: { labelKey: 'shortfall', icon: AlertTriangle, className: 'text-danger' },
  // Also a discrepancy, just the other way. Amber, never green.
  excess: { labelKey: 'excess', icon: ArrowUpCircle, className: 'text-warning-muted-foreground' },
  matched: { labelKey: 'matched', icon: CheckCircle2, className: 'text-success' },
}

/** Colour is never the only signal: icon + word + amount. */
function DifferenceCell({ difference }: { difference: string | null }) {
  const kind = diffKind(difference)
  const style = DIFF_STYLE[kind]
  const Icon = style.icon
  return (
    <span className={`inline-flex items-center gap-1.5 ${style.className}`}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <Bi k={style.labelKey} className="text-xs font-medium" />
      {kind === 'matched' ? null : (
        <Money value={diffMagnitude(difference)} className="text-current" />
      )}
    </span>
  )
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function AdminReconciliationClient({
  initial,
  agents,
}: {
  initial: ReconRow[]
  agents: Agent[]
}) {
  const [rows, setRows] = useState<ReconRow[]>(initial)
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)

  const [actioning, setActioning] = useState<string | null>(null)
  const [verifyTarget, setVerifyTarget] = useState<ReconRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReconRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const filtered = useMemo(
    () =>
      rows.filter(r => {
        const matchAgent = agentFilter === 'ALL' || r.agent_id === agentFilter
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
        return matchAgent && matchStatus
      }),
    [rows, agentFilter, statusFilter],
  )

  const queueRows = useMemo(() => filtered.filter(r => ACTIONABLE.has(r.status)), [filtered])
  const otherRows = useMemo(() => filtered.filter(r => !ACTIONABLE.has(r.status)), [filtered])

  const totalShortfall = useMemo(
    () =>
      filtered.reduce((sum, r) => {
        const n = toNumber(r.difference ?? '0')
        return n > 0 ? sum + n : sum
      }, 0),
    [filtered],
  )
  const matchedCount = useMemo(
    () => filtered.filter(r => diffKind(r.difference) === 'matched').length,
    [filtered],
  )

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (agentFilter !== 'ALL') params.set('agent_id', agentFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (from) params.set('start', from)
    if (to) params.set('end', to)
    const res = await apiGet<ReconRow[]>(`/api/admin/reconciliation?${params}`)
    setLoading(false)
    if (!res.ok) return
    setRows(
      res.data.map(r => ({
        ...r,
        cash_collected: String(r.cash_collected),
        cash_submitted: String(r.cash_submitted),
        difference: r.difference == null ? null : String(r.difference),
      })),
    )
  }

  async function verifyReconciliation() {
    const target = verifyTarget
    if (!target) return
    setActioning(target.id)
    const res = await apiPatch<ReconPatchResult>(`/api/admin/reconciliation/${target.id}`, {
      action: 'verify',
    })
    setActioning(null)
    // Failure: the row keeps its previous status, the dialog stays open.
    if (!res.ok) return
    setRows(prev =>
      prev.map(r =>
        r.id === target.id ? { ...r, status: res.data.status ?? 'VERIFIED' } : r,
      ),
    )
    setVerifyTarget(null)
    toast.success(t('reconciliationVerified').en)
  }

  async function rejectReconciliation() {
    const target = rejectTarget
    const reason = rejectReason.trim()
    if (!target || !reason) return
    setActioning(target.id)
    const res = await apiPatch<ReconPatchResult>(`/api/admin/reconciliation/${target.id}`, {
      action: 'reject',
      reason,
    })
    setActioning(null)
    // Failure: the typed reason stays in the open dialog.
    if (!res.ok) return
    setRows(prev =>
      prev.map(r =>
        r.id === target.id
          ? { ...r, status: res.data.status ?? 'REJECTED', rejection_reason: reason }
          : r,
      ),
    )
    setRejectTarget(null)
    setRejectReason('')
    toast.success(t('reconciliationRejected').en)
  }

  function exportCSV() {
    const header = ['Agent', 'Date', 'Collected', 'Submitted', 'Difference', 'Status', 'Rejection Reason']
    const body = filtered.map(r => [
      r.agent_name,
      r.date,
      r.cash_collected,
      r.cash_submitted,
      r.difference ?? '0',
      r.status,
      r.rejection_reason,
    ])
    const csv = [header, ...body].map(row => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'reconciliation.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function rowActions(row: ReconRow, layout: 'card' | 'row') {
    if (!ACTIONABLE.has(row.status)) return null
    const busy = actioning === row.id
    return (
      <div className={layout === 'card' ? 'flex flex-col gap-2' : 'flex gap-2'}>
        <Button
          variant="success"
          size={layout === 'card' ? 'default' : 'sm'}
          disabled={busy}
          onClick={() => setVerifyTarget(row)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          <Bi k="verify" />
        </Button>
        <Button
          variant="destructive"
          size={layout === 'card' ? 'default' : 'sm'}
          disabled={busy}
          onClick={() => {
            setRejectTarget(row)
            setRejectReason('')
          }}
        >
          <XCircle />
          <Bi k="reject" />
        </Button>
      </div>
    )
  }

  const columns: DataListColumn<ReconRow>[] = [
    {
      key: 'agent',
      header: <Bi k="agent" />,
      primary: true,
      cell: r => <span className="font-medium">{r.agent_name ?? '—'}</span>,
    },
    {
      key: 'date',
      header: <Bi k="date" />,
      cell: r => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.date)}</span>
      ),
    },
    {
      key: 'collected',
      header: <Bi k="cashCollected" />,
      align: 'right',
      cell: r => <Money value={r.cash_collected} />,
    },
    {
      key: 'submitted',
      header: <Bi k="submittedAmount" />,
      align: 'right',
      cell: r => <Money value={r.cash_submitted} />,
    },
    {
      key: 'difference',
      header: <Bi k="difference" />,
      cell: r => <DifferenceCell difference={r.difference} />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: r => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={r.status} />
          {r.rejection_reason ? (
            <span className="max-w-40 truncate text-xs text-danger" title={r.rejection_reason}>
              {r.rejection_reason}
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
      cell: r => rowActions(r, 'row'),
    },
  ]

  const renderCard = (r: ReconRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.agent_name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      {/* The difference is the number this screen exists for. */}
      <div className="rounded-lg bg-muted p-3">
        <DifferenceCell difference={r.difference} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">
            <Bi k="cashCollected" />
          </dt>
          <dd>
            <Money value={r.cash_collected} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            <Bi k="submittedAmount" />
          </dt>
          <dd>
            <Money value={r.cash_submitted} />
          </dd>
        </div>
      </dl>

      {r.rejection_reason ? (
        <p className="text-xs text-danger">{r.rejection_reason}</p>
      ) : null}
      {rowActions(r, 'card')}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="cashSettlement"
        action={
          <Button variant="outline" onClick={exportCSV}>
            <Download />
            <Bi k="exportCsv" />
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <StatTile
          icon={Clock}
          labelKey="toVerify"
          value={queueRows.length}
          kind="count"
          intent="warning"
        />
        <StatTile
          icon={AlertTriangle}
          labelKey="totalShortfall"
          value={totalShortfall}
          intent={totalShortfall > 0 ? 'danger' : 'neutral'}
          compact
        />
        <StatTile
          icon={CheckCircle2}
          labelKey="matched"
          value={matchedCount}
          kind="count"
          intent="success"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          <Bi k="pendingQueue" />
        </h2>
        <DataList
          items={queueRows}
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

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField labelKey="agent" htmlFor="rec-agent">
              <Select value={agentFilter} onValueChange={v => setAgentFilter(v ?? 'ALL')}>
                <SelectTrigger id="rec-agent">
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
            <FormField labelKey="status" htmlFor="rec-status">
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'ALL')}>
                <SelectTrigger id="rec-status">
                  <SelectValue>
                    <Bi
                      k={STATUS_FILTERS.find(o => o.value === statusFilter)?.key ?? 'allStatus'}
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
            <FormField labelKey="from" htmlFor="rec-from">
              <Input
                id="rec-from"
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </FormField>
            <FormField labelKey="to" htmlFor="rec-to">
              <Input id="rec-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </FormField>
          </div>
          <Button onClick={fetchData} disabled={loading} className="md:self-start">
            {loading ? <Loader2 className="animate-spin" /> : null}
            <Bi k="applyFilters" />
          </Button>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          <Bi k="allRecords" />
        </h2>
        <DataList
          items={otherRows}
          getKey={r => r.id}
          columns={columns}
          renderCard={renderCard}
          empty={<EmptyState icon={Inbox} titleKey="noReconciliationsYet" />}
        />
      </section>

      {/* Verify — accepting the cash, so the submitted amount is shown large. */}
      <Dialog
        open={!!verifyTarget}
        onOpenChange={open => {
          if (!open && !actioning) setVerifyTarget(null)
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="verifyReconciliation" />
          </DialogTitle>
          <DialogDescription>
            <Bi k="moneyMovesWarning" />
          </DialogDescription>
          {verifyTarget ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-muted p-4 text-center">
              <span className="text-sm text-muted-foreground">
                {verifyTarget.agent_name ?? '—'} · {formatDate(verifyTarget.date)}
              </span>
              <Money value={verifyTarget.cash_submitted} size="stat" intent="in" />
              <span className="text-xs text-muted-foreground">
                <Bi k="verifyThisAmount" />
              </span>
              <DifferenceCell difference={verifyTarget.difference} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              variant="success"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={verifyReconciliation}
            >
              {actioning ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              <Bi k="verify" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={() => setVerifyTarget(null)}
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
            <Bi k="rejectReconciliation" />
          </DialogTitle>
          {rejectTarget ? (
            <DialogDescription>
              {rejectTarget.agent_name ?? '—'} · {formatDate(rejectTarget.date)}
            </DialogDescription>
          ) : null}
          {rejectTarget ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-muted p-4 text-center">
              <Money value={rejectTarget.cash_submitted} size="stat" />
              <DifferenceCell difference={rejectTarget.difference} />
            </div>
          ) : null}
          <FormField
            labelKey="rejectionReason"
            htmlFor="rec-reject-reason"
            required
            hint={<Bi k="reasonVisibleToAgent" />}
          >
            <Textarea
              id="rec-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('enterReason').en}
            />
          </FormField>
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              variant="destructive"
              size="lg"
              className="md:flex-1"
              disabled={!rejectReason.trim() || !!actioning}
              onClick={rejectReconciliation}
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
