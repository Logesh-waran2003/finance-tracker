'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Pencil, Search, UserX, UserCheck } from 'lucide-react'

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
}

interface Agent { id: string; full_name: string }
interface Branch { id: string; name: string }

interface FormState {
  full_name: string; customer_code: string; phone: string; email: string
  address: string; area: string; city: string; state: string; pincode: string
  opening_balance: string; assigned_agent_id: string; branch_id: string; notes: string
}

const emptyForm: FormState = {
  full_name: '', customer_code: '', phone: '', email: '',
  address: '', area: '', city: '', state: '', pincode: '',
  opening_balance: '0', assigned_agent_id: '', branch_id: '', notes: '',
}

export function AdminCustomerTable({ initial, agents, branches }: {
  initial: Customer[]
  agents: Agent[]
  branches: Branch[]
}) {
  const [customers, setCustomers] = useState<Customer[]>(initial)
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function openAdd() { setEditing(null); setForm(emptyForm); setErr(''); setDialogOpen(true) }
  function openEdit(c: Customer) {
    setEditing(c)
    setForm({
      full_name: c.full_name, customer_code: c.customer_code,
      phone: c.phone ?? '', email: '', address: '', area: c.area ?? '',
      city: c.city ?? '', state: '', pincode: '',
      opening_balance: c.opening_balance, assigned_agent_id: c.assigned_agent_id ?? '',
      branch_id: c.branch_id ?? '', notes: '',
    })
    setErr(''); setDialogOpen(true)
  }

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_code.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
    const matchAgent = agentFilter === 'ALL' || c.assigned_agent_id === agentFilter
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? c.is_active : !c.is_active)
    return matchSearch && matchAgent && matchStatus
  })

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  async function save() {
    if (!form.full_name) { setErr('Full name is required'); return }
    setSaving(true); setErr('')

    const url = editing ? `/api/admin/customers/${editing.id}` : '/api/admin/customers'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        assigned_agent_id: form.assigned_agent_id || null,
        branch_id: form.branch_id || null,
        opening_balance: parseFloat(form.opening_balance) || 0,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Failed to save'); setSaving(false); return }

    if (editing) {
      setCustomers(prev => prev.map(c => c.id === editing.id ? { ...c, ...data } : c))
    } else {
      setCustomers(prev => [{ ...data, outstanding_total: '0', agent_name: agents.find(a => a.id === data.assigned_agent_id)?.full_name ?? null }, ...prev])
    }
    setDialogOpen(false); setSaving(false)
  }

  async function toggleActive(c: Customer) {
    const res = await fetch(`/api/admin/customers/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    })
    if (res.ok) setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Customers</h1>
        <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" />Add Customer</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8 w-56" placeholder="Search name, code, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <Select value={agentFilter} onValueChange={v => { setAgentFilter(v || 'ALL'); setPage(0) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Agents" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Agents</SelectItem>
            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
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

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Code', 'Name', 'Phone', 'Area', 'Agent', 'Outstanding', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No customers found</td></tr>}
              {paged.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.customer_code}</td>
                  <td className="px-4 py-3 font-medium">{c.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.area ?? c.city ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.agent_name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-orange-600">₹{parseFloat(c.outstanding_total).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm"
                        className={c.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}
                        onClick={() => toggleActive(c)}>
                        {c.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-gray-500">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="font-semibold text-lg">{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Customer Code</Label><Input value={form.customer_code} onChange={e => setForm(f => ({ ...f, customer_code: e.target.value }))} placeholder="Auto-generated if blank" /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Area</Label><Input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} /></div>
            <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Opening Balance</Label><Input type="number" min="0" step="0.01" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Assigned Agent</Label>
              <Select value={form.assigned_agent_id || '_none'} onValueChange={(v: string | null) => setForm(f => ({ ...f, assigned_agent_id: !v || v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Branch</Label>
              <Select value={form.branch_id || '_none'} onValueChange={(v: string | null) => setForm(f => ({ ...f, branch_id: !v || v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save Changes' : 'Add Customer'}</Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
