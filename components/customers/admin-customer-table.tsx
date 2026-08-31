'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ArrowDownWideNarrow,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserX,
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
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { formatCount, toNumber } from '@/lib/format'
import { t, type LabelKey } from '@/lib/i18n'

interface Customer {
  id: string
  customer_code: string
  full_name: string
  phone: string | null
  area: string | null
  city: string | null
  assigned_agent_id: string | null
  agent_name: string | null
  branch_id: string | null
  opening_balance: string
  is_active: boolean | null
  outstanding_total: string
  loan_amount_total: string
  loan_outstanding_total: string
  active_loan_count: number
}

interface Agent {
  id: string
  full_name: string
}

interface Branch {
  id: string
  name: string
}

interface FormState {
  full_name: string
  customer_code: string
  phone: string
  email: string
  address: string
  area: string
  city: string
  state: string
  pincode: string
  opening_balance: string
  assigned_agent_id: string
  branch_id: string
  notes: string
}

const emptyForm: FormState = {
  full_name: '',
  customer_code: '',
  phone: '',
  email: '',
  address: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
  opening_balance: '0',
  assigned_agent_id: '',
  branch_id: '',
  notes: '',
}

const STATUS_FILTERS: { value: string; key: LabelKey }[] = [
  { value: 'ALL', key: 'allStatus' },
  { value: 'ACTIVE', key: 'statusActive' },
  { value: 'INACTIVE', key: 'statusInactive' },
]

const PAGE_SIZE = 20

export function AdminCustomerTable({
  initial,
  agents,
  branches,
}: {
  initial: Customer[]
  agents: Agent[]
  branches: Branch[]
}) {
  const [customers, setCustomers] = useState<Customer[]>(initial)
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  /** Outstanding is the column that matters, so it leads: largest debt first. */
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [balanceCustomer, setBalanceCustomer] = useState<Customer | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceReason, setBalanceReason] = useState('')
  const [balanceSaving, setBalanceSaving] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  const [deactivating, setDeactivating] = useState<Customer | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await apiGet<Customer[]>('/api/admin/customers', { cache: 'no-store' })
    if (res.ok) setCustomers(res.data)
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = customers.filter(c => {
      const matchSearch =
        !needle ||
        c.full_name.toLowerCase().includes(needle) ||
        c.customer_code.toLowerCase().includes(needle) ||
        (c.phone ?? '').includes(needle)
      const matchAgent = agentFilter === 'ALL' || c.assigned_agent_id === agentFilter
      const matchStatus =
        statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? !!c.is_active : !c.is_active)
      return matchSearch && matchAgent && matchStatus
    })
    // toNumber for comparison only — the string is what reaches <Money>.
    return [...list].sort((a, b) => {
      const diff = toNumber(a.outstanding_total) - toNumber(b.outstanding_total)
      return sortDesc ? -diff : diff
    })
  }, [customers, search, agentFilter, statusFilter, sortDesc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({
      ...emptyForm,
      full_name: c.full_name,
      customer_code: c.customer_code,
      phone: c.phone ?? '',
      area: c.area ?? '',
      city: c.city ?? '',
      opening_balance: c.opening_balance,
      assigned_agent_id: c.assigned_agent_id ?? '',
      branch_id: c.branch_id ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function save() {
    if (!form.full_name.trim()) {
      setFormError(t('nameRequired').en)
      return
    }
    setSaving(true)
    setFormError(null)

    const payload = {
      ...form,
      email: form.email || null,
      assigned_agent_id: form.assigned_agent_id || null,
      branch_id: form.branch_id || null,
      // Only sent on CREATE — an edit must never overwrite the opening balance.
      ...(editing ? {} : { opening_balance: toNumber(form.opening_balance) }),
    }

    const res = editing
      ? await apiPatch<Customer>(`/api/admin/customers/${editing.id}`, payload)
      : await apiPost<Customer>('/api/admin/customers', payload)

    setSaving(false)
    // Failure: the dialog stays open with everything the admin typed.
    if (!res.ok) {
      setFormError(res.error)
      return
    }
    await refresh()
    setDialogOpen(false)
    toast.success(t('customerSaved').en)
  }

  function openBalance(c: Customer) {
    setBalanceCustomer(c)
    setBalanceAmount('')
    setBalanceReason('')
    setBalanceError(null)
  }

  async function saveBalance() {
    const target = balanceCustomer
    if (!target) return
    const amount = toNumber(balanceAmount)
    if (!balanceAmount.trim() || amount <= 0) {
      setBalanceError(t('enterValidAmount').en)
      return
    }
    if (!balanceReason.trim()) {
      setBalanceError(t('reasonRequired').en)
      return
    }
    setBalanceSaving(true)
    setBalanceError(null)
    const res = await apiPatch<Customer>(`/api/admin/customers/${target.id}`, {
      balance_deduction: amount,
      _balance_reason: balanceReason.trim(),
    })
    setBalanceSaving(false)
    if (!res.ok) {
      setBalanceError(res.error)
      return
    }
    await refresh()
    setBalanceCustomer(null)
    toast.success(t('balanceAdjusted').en)
  }

  async function setActive(c: Customer, next: boolean) {
    setTogglingId(c.id)
    const res = await apiPatch<Customer>(`/api/admin/customers/${c.id}`, { is_active: next })
    setTogglingId(null)
    // Failure: the row stays exactly as it was.
    if (!res.ok) return
    setCustomers(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: next } : x)))
    setDeactivating(null)
  }

  function rowActions(c: Customer, layout: 'card' | 'row') {
    const size = layout === 'card' ? 'default' : 'sm'
    const busy = togglingId === c.id
    return (
      <div className={layout === 'card' ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
        <Button variant="outline" size={size} onClick={() => openEdit(c)}>
          <Pencil />
          <Bi k="edit" />
        </Button>
        <Button variant="outline" size={size} onClick={() => openBalance(c)}>
          <IndianRupee />
          <Bi k="balance" />
        </Button>
        {c.is_active ? (
          <Button
            variant="destructive"
            size={size}
            disabled={busy}
            className={layout === 'card' ? 'col-span-2' : undefined}
            onClick={() => setDeactivating(c)}
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserX />}
            <Bi k="deactivate" />
          </Button>
        ) : (
          <Button
            variant="success"
            size={size}
            disabled={busy}
            className={layout === 'card' ? 'col-span-2' : undefined}
            onClick={() => setActive(c, true)}
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserCheck />}
            <Bi k="activate" />
          </Button>
        )}
      </div>
    )
  }

  const columns: DataListColumn<Customer>[] = [
    {
      key: 'code',
      header: <Bi k="customerCode" />,
      hideOnMobile: true,
      cell: c => <span className="font-mono text-xs text-muted-foreground">{c.customer_code}</span>,
    },
    {
      key: 'name',
      header: <Bi k="customerName" />,
      primary: true,
      cell: c => <span className="font-medium">{c.full_name}</span>,
    },
    {
      key: 'phone',
      header: <Bi k="phone" />,
      cell: c => <span className="text-muted-foreground">{c.phone ?? '—'}</span>,
    },
    {
      key: 'area',
      header: <Bi k="area" />,
      cell: c => <span className="text-muted-foreground">{c.area ?? c.city ?? '—'}</span>,
    },
    {
      key: 'agent',
      header: <Bi k="assignedAgent" />,
      cell: c => (
        <span className="block max-w-32 truncate text-muted-foreground">
          {c.agent_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'loan',
      header: <Bi k="activeLoan" />,
      align: 'right',
      hideOnMobile: true,
      cell: c =>
        c.active_loan_count > 0 ? (
          <div className="flex flex-col items-end">
            <Money value={c.loan_amount_total} />
            <Money value={c.loan_outstanding_total} size="caption" intent="owed" />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'outstanding',
      header: <Bi k="outstanding" />,
      align: 'right',
      // Amber, never green: green means "collected", and a debt shown green
      // reads as good news.
      cell: c => <Money value={c.outstanding_total} intent="owed" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: c => <StatusBadge status={c.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: c => rowActions(c, 'row'),
    },
  ]

  const renderCard = (c: Customer) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{c.full_name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{c.customer_code}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Money value={c.outstanding_total} intent="owed" />
          <span className="text-xs text-muted-foreground">
            <Bi k="outstanding" />
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge status={c.is_active ? 'ACTIVE' : 'INACTIVE'} />
        <span>{c.phone ?? '—'}</span>
        <span>{c.area ?? c.city ?? '—'}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        <Bi k="assignedAgent" /> · {c.agent_name ?? '—'}
      </p>
      {rowActions(c, 'card')}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="customers"
        action={
          <Button onClick={openAdd}>
            <Plus />
            <Bi k="addCustomer" />
          </Button>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          <FormField labelKey="search" htmlFor="cust-search">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="cust-search"
                className="pl-9"
                placeholder={t('searchCustomers').en}
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
              />
            </div>
          </FormField>

          <FormField labelKey="assignedAgent" htmlFor="cust-agent">
            <Select
              value={agentFilter}
              onValueChange={v => {
                setAgentFilter(v ?? 'ALL')
                setPage(0)
              }}
            >
              <SelectTrigger id="cust-agent">
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

          <FormField labelKey="status" htmlFor="cust-status">
            <Select
              value={statusFilter}
              onValueChange={v => {
                setStatusFilter(v ?? 'ALL')
                setPage(0)
              }}
            >
              <SelectTrigger id="cust-status">
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

          <FormField labelKey="sortByOutstanding" htmlFor="cust-sort">
            <Select
              value={sortDesc ? 'DESC' : 'ASC'}
              onValueChange={v => setSortDesc(v !== 'ASC')}
            >
              <SelectTrigger id="cust-sort">
                <SelectValue>
                  <span className="inline-flex items-center gap-2">
                    <ArrowDownWideNarrow aria-hidden="true" className="size-4" />
                    <Bi k={sortDesc ? 'highestFirst' : 'lowestFirst'} />
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">
                  <Bi k="highestFirst" />
                </SelectItem>
                <SelectItem value="ASC">
                  <Bi k="lowestFirst" />
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <DataList
        items={paged}
        getKey={c => c.id}
        columns={columns}
        renderCard={renderCard}
        empty={<EmptyState titleKey="noCustomersFound" />}
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={safePage === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            <Bi k="prev" />
          </Button>
          <span className="text-sm text-muted-foreground">
            <Bi k="page" /> {formatCount(safePage + 1)} / {formatCount(totalPages)}
          </span>
          <Button
            variant="outline"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            <Bi k="next" />
          </Button>
        </div>
      ) : null}

      {/* Add / edit */}
      <Dialog
        open={dialogOpen}
        onOpenChange={open => {
          if (!open && !saving) setDialogOpen(false)
        }}
      >
        <DialogContent className="md:max-w-lg">
          <DialogTitle>
            <Bi k={editing ? 'editCustomer' : 'addCustomer'} />
          </DialogTitle>

          <div className="flex flex-col gap-4">
            <FormField labelKey="fullName" htmlFor="cust-name" required error={formError}>
              <Input
                id="cust-name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="customerCode" htmlFor="cust-code">
                <Input
                  id="cust-code"
                  value={form.customer_code}
                  placeholder={t('autoGeneratedIfBlank').en}
                  onChange={e => setForm(f => ({ ...f, customer_code: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="phone" htmlFor="cust-phone">
                <Input
                  id="cust-phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="area" htmlFor="cust-area">
                <Input
                  id="cust-area"
                  value={form.area}
                  onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="city" htmlFor="cust-city">
                <Input
                  id="cust-city"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField
              labelKey="address"
              htmlFor="cust-address"
              hint={
                <GMapsLink
                  query={[form.address, form.area, form.city].filter(Boolean).join(', ')}
                />
              }
            >
              <Input
                id="cust-address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </FormField>

            {!editing ? (
              <FormField
                labelKey="openingBalance"
                htmlFor="cust-opening"
                hint={<Bi k="openingBalanceHint" />}
              >
                <Input
                  id="cust-opening"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                />
              </FormField>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="assignedAgent" htmlFor="cust-form-agent">
                <Select
                  value={form.assigned_agent_id || '_none'}
                  onValueChange={v =>
                    setForm(f => ({ ...f, assigned_agent_id: !v || v === '_none' ? '' : v }))
                  }
                >
                  <SelectTrigger id="cust-form-agent">
                    <SelectValue>
                      {form.assigned_agent_id ? (
                        (agents.find(a => a.id === form.assigned_agent_id)?.full_name ?? '—')
                      ) : (
                        <Bi k="none" />
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">
                      <Bi k="none" />
                    </SelectItem>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField labelKey="branch" htmlFor="cust-form-branch">
                <Select
                  value={form.branch_id || '_none'}
                  onValueChange={v =>
                    setForm(f => ({ ...f, branch_id: !v || v === '_none' ? '' : v }))
                  }
                >
                  <SelectTrigger id="cust-form-branch">
                    <SelectValue>
                      {form.branch_id ? (
                        (branches.find(b => b.id === form.branch_id)?.name ?? '—')
                      ) : (
                        <Bi k="none" />
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">
                      <Bi k="none" />
                    </SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField labelKey="notesOptional" htmlFor="cust-notes">
              <Input
                id="cust-notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button size="lg" className="md:flex-1" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              <Bi k={editing ? 'saveChanges' : 'addCustomer'} />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Opening balance adjustment */}
      <Dialog
        open={!!balanceCustomer}
        onOpenChange={open => {
          if (!open && !balanceSaving) setBalanceCustomer(null)
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="adjustOpeningBalance" />
          </DialogTitle>
          {balanceCustomer ? (
            <DialogDescription>{balanceCustomer.full_name}</DialogDescription>
          ) : null}
          {balanceCustomer ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-muted p-4 text-center">
              <span className="text-xs text-muted-foreground">
                <Bi k="outstanding" />
              </span>
              <Money value={balanceCustomer.outstanding_total} size="stat" intent="owed" />
            </div>
          ) : null}

          <FormField
            labelKey="amountToDeduct"
            htmlFor="cust-balance-amount"
            required
            error={balanceError}
          >
            <Input
              id="cust-balance-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={balanceAmount}
              onChange={e => setBalanceAmount(e.target.value)}
            />
          </FormField>

          <FormField labelKey="reason" htmlFor="cust-balance-reason" required>
            <Input
              id="cust-balance-reason"
              value={balanceReason}
              onChange={e => setBalanceReason(e.target.value)}
              placeholder={t('balanceReasonHint').en}
            />
          </FormField>

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              size="lg"
              className="md:flex-1"
              disabled={!balanceAmount.trim() || !balanceReason.trim() || balanceSaving}
              onClick={saveBalance}
            >
              {balanceSaving ? <Loader2 className="animate-spin" /> : null}
              <Bi k="update" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={balanceSaving}
              onClick={() => setBalanceCustomer(null)}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <Dialog
        open={!!deactivating}
        onOpenChange={open => {
          if (!open && !togglingId) setDeactivating(null)
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="deactivateCustomer" />
          </DialogTitle>
          <DialogDescription>
            {deactivating?.full_name} — <Bi k="deactivateCustomerWarning" />
          </DialogDescription>
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              variant="destructive"
              size="lg"
              className="md:flex-1"
              disabled={!!togglingId}
              onClick={() => deactivating && setActive(deactivating, false)}
            >
              {togglingId ? <Loader2 className="animate-spin" /> : <UserX />}
              <Bi k="deactivate" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={!!togglingId}
              onClick={() => setDeactivating(null)}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
