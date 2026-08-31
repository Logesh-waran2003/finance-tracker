'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Download, Inbox, Loader2, Receipt, XCircle } from 'lucide-react'
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

interface ExpenseRow {
  id: string
  employee_id: string
  employee_name: string | null
  category_id: string
  category_name: string | null
  amount: string
  payment_mode: string
  description: string
  expense_date: string
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string | null
}

interface Employee {
  id: string
  full_name: string
}

const STATUS_FILTERS: { value: string; key: LabelKey }[] = [
  { value: 'ALL', key: 'allStatus' },
  { value: 'PENDING', key: 'statusPending' },
  { value: 'APPROVED', key: 'statusApproved' },
  { value: 'REJECTED', key: 'statusRejected' },
]

function isoDate(d: Date): string {
  // Built from local parts, not toISOString(): in IST, `toISOString()` on a
  // local midnight rolls the date back one day.
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function monthRange() {
  const now = new Date()
  return {
    start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function AdminExpensesClient({
  initial,
  employees,
}: {
  initial: ExpenseRow[]
  employees: Employee[]
}) {
  const defaultRange = monthRange()
  const [rows, setRows] = useState<ExpenseRow[]>(initial)
  const [from, setFrom] = useState(defaultRange.start)
  const [to, setTo] = useState(defaultRange.end)
  const [empFilter, setEmpFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)

  const [actioning, setActioning] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<ExpenseRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ExpenseRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const filtered = useMemo(
    () =>
      rows.filter(r => {
        const matchEmp = empFilter === 'ALL' || r.employee_id === empFilter
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
        return matchEmp && matchStatus
      }),
    [rows, empFilter, statusFilter],
  )

  const pendingRows = useMemo(() => filtered.filter(r => r.status === 'PENDING'), [filtered])
  const otherRows = useMemo(() => filtered.filter(r => r.status !== 'PENDING'), [filtered])

  const pendingValue = useMemo(
    () => pendingRows.reduce((sum, r) => sum + toNumber(r.amount), 0),
    [pendingRows],
  )
  const approvedTotal = useMemo(
    () =>
      filtered
        .filter(r => r.status === 'APPROVED')
        .reduce((sum, r) => sum + toNumber(r.amount), 0),
    [filtered],
  )

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({ start: from, end: to })
    if (empFilter !== 'ALL') params.set('employee_id', empFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    const res = await apiGet<ExpenseRow[]>(`/api/admin/expenses?${params}`)
    setLoading(false)
    if (!res.ok) return
    setRows(res.data)
  }

  async function approveExpense() {
    const target = approveTarget
    if (!target) return
    setActioning(target.id)
    const res = await apiPatch<Partial<ExpenseRow>>(`/api/admin/expenses/${target.id}`, {
      action: 'approve',
    })
    setActioning(null)
    // Failure: the row keeps its previous state, the dialog stays open.
    if (!res.ok) return
    setRows(prev => prev.map(r => (r.id === target.id ? { ...r, ...res.data } : r)))
    setApproveTarget(null)
    toast.success(t('expenseApproved').en)
  }

  async function rejectExpense() {
    const target = rejectTarget
    const reason = rejectReason.trim()
    if (!target || !reason) return
    setActioning(target.id)
    const res = await apiPatch<Partial<ExpenseRow>>(`/api/admin/expenses/${target.id}`, {
      action: 'reject',
      reason,
    })
    setActioning(null)
    // Failure: the typed reason stays in the open dialog.
    if (!res.ok) return
    setRows(prev => prev.map(r => (r.id === target.id ? { ...r, ...res.data } : r)))
    setRejectTarget(null)
    setRejectReason('')
    toast.success(t('expenseRejected').en)
  }

  function exportCSV() {
    const header = [
      'Employee', 'Category', 'Description', 'Amount', 'Mode', 'Date', 'Status', 'Rejection Reason',
    ]
    const body = filtered.map(r => [
      r.employee_name,
      r.category_name,
      r.description,
      r.amount,
      r.payment_mode,
      r.expense_date,
      r.status,
      r.rejection_reason,
    ])
    const csv = [header, ...body].map(row => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function rowActions(row: ExpenseRow, layout: 'card' | 'row') {
    if (row.status !== 'PENDING') return null
    const busy = actioning === row.id
    return (
      <div className={layout === 'card' ? 'flex flex-col gap-2' : 'flex gap-2'}>
        <Button
          variant="success"
          size={layout === 'card' ? 'default' : 'sm'}
          disabled={busy}
          onClick={() => setApproveTarget(row)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          <Bi k="approve" />
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

  const columns: DataListColumn<ExpenseRow>[] = [
    {
      key: 'employee',
      header: <Bi k="employee" />,
      primary: true,
      cell: r => <span className="font-medium">{r.employee_name ?? '—'}</span>,
    },
    {
      key: 'category',
      header: <Bi k="category" />,
      cell: r => <span className="text-muted-foreground">{r.category_name ?? '—'}</span>,
    },
    {
      key: 'description',
      header: <Bi k="description" />,
      cell: r => (
        <span className="block max-w-48 truncate" title={r.description}>
          {r.description}
        </span>
      ),
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      align: 'right',
      // An expense is money leaving the business once approved.
      cell: r => <Money value={r.amount} intent={r.status === 'APPROVED' ? 'out' : 'neutral'} />,
    },
    {
      key: 'date',
      header: <Bi k="date" />,
      cell: r => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(r.expense_date)}
        </span>
      ),
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

  const renderCard = (r: ExpenseRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.employee_name ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{r.category_name ?? '—'}</p>
        </div>
        <Money
          value={r.amount}
          intent={r.status === 'APPROVED' ? 'out' : 'neutral'}
          className="shrink-0"
        />
      </div>
      <p className="text-sm text-muted-foreground">{r.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <span className="text-xs text-muted-foreground">{formatDate(r.expense_date)}</span>
      </div>
      {r.rejection_reason ? (
        <p className="text-xs text-danger">{r.rejection_reason}</p>
      ) : null}
      {rowActions(r, 'card')}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="officeExpenses"
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
          labelKey="pendingApprovals"
          value={pendingRows.length}
          kind="count"
          intent="warning"
        />
        <StatTile
          icon={Receipt}
          labelKey="pendingValue"
          value={pendingValue}
          intent="warning"
          compact
        />
        <StatTile
          icon={CheckCircle2}
          labelKey="approvedTotal"
          value={approvedTotal}
          intent="neutral"
          compact
          className="col-span-2 md:col-span-1"
        />
      </div>

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

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField labelKey="from" htmlFor="exp-from">
              <Input
                id="exp-from"
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </FormField>
            <FormField labelKey="to" htmlFor="exp-to">
              <Input id="exp-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </FormField>
            <FormField labelKey="employee" htmlFor="exp-emp">
              <Select value={empFilter} onValueChange={v => setEmpFilter(v ?? 'ALL')}>
                <SelectTrigger id="exp-emp">
                  <SelectValue>
                    {empFilter === 'ALL' ? (
                      <Bi k="allEmployees" />
                    ) : (
                      (employees.find(e => e.id === empFilter)?.full_name ?? '—')
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <Bi k="allEmployees" />
                  </SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField labelKey="status" htmlFor="exp-status">
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'ALL')}>
                <SelectTrigger id="exp-status">
                  <SelectValue>
                    <Bi
                      k={
                        STATUS_FILTERS.find(o => o.value === statusFilter)?.key ?? 'allStatus'
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
          empty={<EmptyState icon={Inbox} titleKey="noExpensesYet" />}
        />
      </section>

      {/* Approve — money leaves the business, so the amount is shown large. */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={open => {
          if (!open && !actioning) setApproveTarget(null)
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="approveExpense" />
          </DialogTitle>
          <DialogDescription>
            <Bi k="moneyMovesWarning" />
          </DialogDescription>
          {approveTarget ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-muted p-4 text-center">
              <span className="text-sm text-muted-foreground">
                {approveTarget.employee_name ?? '—'} · {approveTarget.description}
              </span>
              <Money value={approveTarget.amount} size="stat" intent="out" />
              <span className="text-xs text-muted-foreground">
                <Bi k="approveThisAmount" />
              </span>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              variant="success"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={approveExpense}
            >
              {actioning ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              <Bi k="approve" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={!!actioning}
              onClick={() => setApproveTarget(null)}
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
            <Bi k="rejectExpense" />
          </DialogTitle>
          {rejectTarget ? (
            <DialogDescription>
              {rejectTarget.employee_name ?? '—'} · {rejectTarget.description}
            </DialogDescription>
          ) : null}
          {rejectTarget ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-muted p-4 text-center">
              <Money value={rejectTarget.amount} size="stat" />
            </div>
          ) : null}
          <FormField
            labelKey="rejectionReason"
            htmlFor="exp-reject-reason"
            required
            hint={<Bi k="reasonVisibleToAgent" />}
          >
            <Textarea
              id="exp-reject-reason"
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
              onClick={rejectExpense}
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
