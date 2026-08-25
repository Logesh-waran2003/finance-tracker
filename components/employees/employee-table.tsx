'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Loader2, Plus, Pencil, UserCheck, UserX, Search } from 'lucide-react'

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

interface Branch { id: string; name: string }

const roleOptions = ['ADMIN', 'COLLECTION_AGENT', 'STAFF']

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
  full_name: '', email: '', password: '', role: 'STAFF',
  employee_code: '', department: '', designation: '',
  joining_date: '', phone: '', branch_id: '', is_active: true,
}

export function EmployeeTable({ initial, branches }: { initial: Employee[]; branches: Branch[] }) {
  const [employees, setEmployees] = useState<Employee[]>(initial)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null)

  function openAdd() { setEditing(null); setForm(emptyForm); setErr(''); setDialogOpen(true) }
  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      full_name: emp.full_name, email: emp.email, password: '',
      role: emp.role, employee_code: emp.employee_code ?? '',
      department: emp.department ?? '', designation: emp.designation ?? '',
      joining_date: emp.joining_date ?? '', phone: emp.phone ?? '',
      branch_id: emp.branch_id ?? '', is_active: emp.is_active ?? true,
    })
    setErr('')
    setDialogOpen(true)
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_code ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'ALL' || e.role === roleFilter
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? e.is_active : !e.is_active)
    return matchSearch && matchRole && matchStatus
  })

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  async function save() {
    if (!form.full_name || !form.email) { setErr('Name and email are required'); return }
    if (!editing && form.password.length < 8) { setErr('Password must be at least 8 characters'); return }
    setSaving(true); setErr('')

    const url = editing ? `/api/admin/employees/${editing.id}` : '/api/admin/employees'
    const method = editing ? 'PATCH' : 'POST'
    const body: Record<string, unknown> = { ...form }
    if (editing && !form.password) delete body.password

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()

    if (!res.ok) { setErr(data.error ?? 'Failed to save'); setSaving(false); return }

    if (editing) {
      setEmployees(prev => prev.map(e => e.id === editing.id ? { ...e, ...data } : e))
    } else {
      setEmployees(prev => [data, ...prev])
    }
    setDialogOpen(false)
    setSaving(false)
  }

  async function toggleActive(emp: Employee) {
    const res = await fetch(`/api/admin/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !emp.is_active }),
    })
    if (res.ok) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: !emp.is_active } : e))
    }
    setConfirmDeactivate(null)
  }

  const branchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Employees</h1>
        <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" />Add Employee</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8 w-56" placeholder="Search name, email, code..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v || 'ALL'); setPage(0) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {roleOptions.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v || 'ALL'); setPage(0) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="sm:hidden space-y-3 p-3">
            {paged.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No employees found</p>}
            {paged.map(emp => (
              <Card key={emp.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{emp.full_name}</p>
                      <p className="text-xs text-gray-400">{emp.employee_code ?? '—'} {emp.branch_id ? `· ${branchName(emp.branch_id)}` : ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : emp.role === 'COLLECTION_AGENT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {emp.role.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{emp.email}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(emp)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${emp.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`} onClick={() => emp.is_active ? setConfirmDeactivate(emp) : toggleActive(emp)}>
                        {emp.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Code', 'Name', 'Email', 'Role', 'Branch', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No employees found</td></tr>
              )}
              {paged.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{emp.employee_code ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      emp.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                      emp.role === 'COLLECTION_AGENT' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'}`}>
                      {emp.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{branchName(emp.branch_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}><Pencil size={14} /></Button>
                      <Button
                        variant="ghost" size="sm"
                        className={emp.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}
                        onClick={() => emp.is_active ? setConfirmDeactivate(emp) : toggleActive(emp)}
                      >
                        {emp.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-gray-500">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="font-semibold text-lg">{editing ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1"><Label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={editing ? 0 : 8} /></div>
              <div className="space-y-1"><Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v || f.role }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{roleOptions.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Branch</Label>
                <Select value={form.branch_id || '_none'} onValueChange={v => setForm(f => ({ ...f, branch_id: (v || '') === '_none' ? '' : (v || '') }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Employee Code</Label><Input value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Joining Date</Label><Input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} /></div>
              {editing && (
                <div className="space-y-1 flex items-center gap-2 pt-6">
                  <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save Changes' : 'Add Employee'}</Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Deactivate */}
      {confirmDeactivate && (
        <Dialog open={true} onOpenChange={() => setConfirmDeactivate(null)}>
          <DialogContent className="max-w-sm">
            <DialogTitle className="font-semibold">Deactivate Employee?</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              {confirmDeactivate.full_name} will not be able to log in until reactivated.
            </DialogDescription>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => toggleActive(confirmDeactivate!)}>Deactivate</Button>
              <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
