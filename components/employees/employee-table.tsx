'use client'

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react'
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
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiPatch, apiPost } from '@/lib/api-client'
import { formatCount } from '@/lib/format'
import { statusLabel, t, type LabelKey } from '@/lib/i18n'

interface Employee {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  employee_code: string | null
  department: string | null
  designation: string | null
  branch_id: string | null
  joining_date: string | null
  is_active: boolean | null
}

interface Branch {
  id: string
  name: string
}

const ROLE_OPTIONS = ['ADMIN', 'COLLECTION_AGENT', 'STAFF'] as const

const STATUS_FILTERS: { value: string; key: LabelKey }[] = [
  { value: 'ALL', key: 'allStatus' },
  { value: 'ACTIVE', key: 'statusActive' },
  { value: 'INACTIVE', key: 'statusInactive' },
]

interface FormState {
  full_name: string
  email: string
  password: string
  role: string
  employee_code: string
  department: string
  designation: string
  joining_date: string
  phone: string
  branch_id: string
  is_active: boolean
}

const emptyForm: FormState = {
  full_name: '',
  email: '',
  password: '',
  role: 'STAFF',
  employee_code: '',
  department: '',
  designation: '',
  joining_date: '',
  phone: '',
  branch_id: '',
  is_active: true,
}

const PAGE_SIZE = 20

export function EmployeeTable({
  initial,
  branches,
}: {
  initial: Employee[]
  branches: Branch[]
}) {
  const [employees, setEmployees] = useState<Employee[]>(initial)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deactivating, setDeactivating] = useState<Employee | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return employees.filter(e => {
      const matchSearch =
        !needle ||
        e.full_name.toLowerCase().includes(needle) ||
        e.email.toLowerCase().includes(needle) ||
        (e.employee_code ?? '').toLowerCase().includes(needle)
      const matchRole = roleFilter === 'ALL' || e.role === roleFilter
      const matchStatus =
        statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? !!e.is_active : !e.is_active)
      return matchSearch && matchRole && matchStatus
    })
  }, [employees, search, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const branchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? '—'

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      password: '',
      role: emp.role,
      employee_code: emp.employee_code ?? '',
      department: emp.department ?? '',
      designation: emp.designation ?? '',
      joining_date: emp.joining_date ?? '',
      phone: emp.phone ?? '',
      branch_id: emp.branch_id ?? '',
      is_active: emp.is_active ?? true,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function save() {
    if (!form.full_name.trim() || !form.email.trim()) {
      setFormError(t('nameAndEmailRequired').en)
      return
    }
    if (!editing && form.password.length < 8) {
      setFormError(t('passwordMinLength').en)
      return
    }
    setSaving(true)
    setFormError(null)

    const body: Record<string, unknown> = { ...form }
    if (editing && !form.password) delete body.password

    const res = editing
      ? await apiPatch<Employee>(`/api/admin/employees/${editing.id}`, body)
      : await apiPost<Employee>('/api/admin/employees', body)

    setSaving(false)
    // Failure: the dialog stays open with everything the admin typed.
    if (!res.ok) {
      setFormError(res.error)
      return
    }

    if (editing) {
      setEmployees(prev => prev.map(e => (e.id === editing.id ? { ...e, ...res.data } : e)))
    } else {
      setEmployees(prev => [res.data, ...prev])
    }
    setDialogOpen(false)
    toast.success(t('employeeSaved').en)
  }

  async function setActive(emp: Employee, next: boolean) {
    setTogglingId(emp.id)
    const res = await apiPatch<Employee>(`/api/admin/employees/${emp.id}`, { is_active: next })
    setTogglingId(null)
    // Failure: the row stays exactly as it was.
    if (!res.ok) return
    setEmployees(prev => prev.map(e => (e.id === emp.id ? { ...e, is_active: next } : e)))
    setDeactivating(null)
  }

  function rowActions(emp: Employee, layout: 'card' | 'row') {
    const size = layout === 'card' ? 'default' : 'sm'
    const busy = togglingId === emp.id
    return (
      <div className={layout === 'card' ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
        <Button variant="outline" size={size} onClick={() => openEdit(emp)}>
          <Pencil />
          <Bi k="edit" />
        </Button>
        {emp.is_active ? (
          <Button
            variant="destructive"
            size={size}
            disabled={busy}
            onClick={() => setDeactivating(emp)}
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserX />}
            <Bi k="deactivate" />
          </Button>
        ) : (
          <Button
            variant="success"
            size={size}
            disabled={busy}
            onClick={() => setActive(emp, true)}
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserCheck />}
            <Bi k="activate" />
          </Button>
        )}
      </div>
    )
  }

  const columns: DataListColumn<Employee>[] = [
    {
      key: 'code',
      header: <Bi k="employeeCode" />,
      hideOnMobile: true,
      cell: e => (
        <span className="font-mono text-xs text-muted-foreground">{e.employee_code ?? '—'}</span>
      ),
    },
    {
      key: 'name',
      header: <Bi k="name" />,
      primary: true,
      cell: e => <span className="font-medium">{e.full_name}</span>,
    },
    {
      key: 'email',
      header: <Bi k="email" />,
      cell: e => (
        <span className="block max-w-48 truncate text-muted-foreground">{e.email}</span>
      ),
    },
    {
      key: 'role',
      header: <Bi k="role" />,
      cell: e => <StatusBadge status={e.role} />,
    },
    {
      key: 'branch',
      header: <Bi k="branch" />,
      cell: e => <span className="text-muted-foreground">{branchName(e.branch_id)}</span>,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: e => <StatusBadge status={e.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: e => rowActions(e, 'row'),
    },
  ]

  const renderCard = (emp: Employee) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{emp.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {emp.employee_code ?? '—'}
            {emp.branch_id ? ` · ${branchName(emp.branch_id)}` : ''}
          </p>
        </div>
        <StatusBadge status={emp.role} />
      </div>
      <p className="truncate text-sm text-muted-foreground">{emp.email}</p>
      <StatusBadge status={emp.is_active ? 'ACTIVE' : 'INACTIVE'} />
      {rowActions(emp, 'card')}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="employees"
        action={
          <Button onClick={openAdd}>
            <Plus />
            <Bi k="addEmployee" />
          </Button>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          <FormField labelKey="search" htmlFor="emp-search">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="emp-search"
                className="pl-9"
                placeholder={t('searchEmployees').en}
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
              />
            </div>
          </FormField>

          <FormField labelKey="role" htmlFor="emp-role">
            <Select
              value={roleFilter}
              onValueChange={v => {
                setRoleFilter(v ?? 'ALL')
                setPage(0)
              }}
            >
              <SelectTrigger id="emp-role">
                <SelectValue>
                  {roleFilter === 'ALL' ? (
                    <Bi k="allRoles" />
                  ) : (
                    <Bi label={statusLabel(roleFilter)} />
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  <Bi k="allRoles" />
                </SelectItem>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r} value={r}>
                    <Bi label={statusLabel(r)} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField labelKey="status" htmlFor="emp-status">
            <Select
              value={statusFilter}
              onValueChange={v => {
                setStatusFilter(v ?? 'ALL')
                setPage(0)
              }}
            >
              <SelectTrigger id="emp-status">
                <SelectValue>
                  <Bi k={STATUS_FILTERS.find(o => o.value === statusFilter)?.key ?? 'allStatus'} />
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
        </CardContent>
      </Card>

      <DataList
        items={paged}
        getKey={e => e.id}
        columns={columns}
        renderCard={renderCard}
        empty={<EmptyState titleKey="noEmployeesFound" />}
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
            <Bi k={editing ? 'editEmployee' : 'addEmployee'} />
          </DialogTitle>

          <div className="flex flex-col gap-4">
            <FormField labelKey="fullName" htmlFor="emp-name" required error={formError}>
              <Input
                id="emp-name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </FormField>

            <FormField labelKey="email" htmlFor="emp-email" required>
              <Input
                id="emp-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </FormField>

            <FormField
              labelKey={editing ? 'newPasswordBlankToKeep' : 'password'}
              htmlFor="emp-password"
              required={!editing}
              hint={editing ? null : <Bi k="passwordMinLength" />}
            >
              <Input
                id="emp-password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="role" htmlFor="emp-form-role">
                <Select
                  value={form.role}
                  onValueChange={v => setForm(f => ({ ...f, role: v ?? f.role }))}
                >
                  <SelectTrigger id="emp-form-role">
                    <SelectValue>
                      <Bi label={statusLabel(form.role)} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>
                        <Bi label={statusLabel(r)} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField labelKey="branch" htmlFor="emp-form-branch">
                <Select
                  value={form.branch_id || '_none'}
                  onValueChange={v =>
                    setForm(f => ({ ...f, branch_id: !v || v === '_none' ? '' : v }))
                  }
                >
                  <SelectTrigger id="emp-form-branch">
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="employeeCode" htmlFor="emp-code">
                <Input
                  id="emp-code"
                  value={form.employee_code}
                  placeholder={t('autoGeneratedIfBlank').en}
                  onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="phone" htmlFor="emp-phone">
                <Input
                  id="emp-phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="department" htmlFor="emp-dept">
                <Input
                  id="emp-dept"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="designation" htmlFor="emp-desig">
                <Input
                  id="emp-desig"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField labelKey="joiningDate" htmlFor="emp-joining">
              <Input
                id="emp-joining"
                type="date"
                value={form.joining_date}
                onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button size="lg" className="md:flex-1" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              <Bi k={editing ? 'saveChanges' : 'addEmployee'} />
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

      {/* Deactivate confirmation — never a window.confirm. */}
      <Dialog
        open={!!deactivating}
        onOpenChange={open => {
          if (!open && !togglingId) setDeactivating(null)
        }}
      >
        <DialogContent>
          <DialogTitle>
            <Bi k="deactivateEmployee" />
          </DialogTitle>
          <DialogDescription>
            {deactivating?.full_name} — <Bi k="deactivateEmployeeWarning" />
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
