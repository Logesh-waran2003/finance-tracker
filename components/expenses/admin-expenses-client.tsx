'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, CheckCircle, XCircle, Download } from 'lucide-react'

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
  approved_at: Date | string | null
  rejection_reason: string | null
  created_at: Date | string | null
}

interface Employee { id: string; full_name: string }

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(val: string | number) {
  return '₹' + parseFloat(String(val)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(start), end: fmt(end) }
}

export function AdminExpensesClient({
  initial,
  employees,
}: {
  initial: ExpenseRow[]
  employees: Employee[]
}) {
  const defaultRange = getMonthRange()
  const [rows, setRows] = useState(initial)
  const [from, setFrom] = useState(defaultRange.start)
  const [to, setTo] = useState(defaultRange.end)
  const [empFilter, setEmpFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)

  const [rejecting, setRejecting] = useState<ExpenseRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({ start: from, end: to })
    if (empFilter !== 'ALL') params.set('employee_id', empFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    const res = await fetch(`/api/admin/expenses?${params}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  async function action(id: string, act: 'approve' | 'reject', reason?: string) {
    setActionLoading(id); setActionErr('')
    const res = await fetch(`/api/admin/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act, reason }),
    })
    const data = await res.json()
    if (!res.ok) { setActionErr(data.error ?? 'Failed'); setActionLoading(null); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
    setRejecting(null); setRejectReason(''); setActionLoading(null)
  }

  function exportCSV() {
    const header = ['Employee', 'Category', 'Description', 'Amount', 'Mode', 'Date', 'Status']
    const data = filtered.map(r => [
      r.employee_name ?? '', r.category_name ?? '', r.description,
      parseFloat(r.amount).toFixed(2), r.payment_mode, r.expense_date, r.status,
    ])
    const csv = [header, ...data].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `expenses-${from}-to-${to}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const filtered = rows.filter(r => {
    const matchEmp = empFilter === 'ALL' || r.employee_id === empFilter
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
    return matchEmp && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Office Expenses</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download size={14} className="mr-1" />Export CSV
        </Button>
      </div>

      {actionErr && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{actionErr}</p>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" />
        </div>
        <Select value={empFilter} onValueChange={v => setEmpFilter(v || 'ALL')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Employees</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v || 'ALL')}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="sm:hidden space-y-3 p-3">
            {filtered.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No records found</p>}
            {filtered.map(r => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{r.employee_name ?? '—'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{r.category_name ?? '—'}</span>
                    <span className="font-medium">{fmtCurrency(r.amount)}</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{r.description}</p>
                  <p className="text-xs text-gray-400">{fmtDate(r.expense_date)}</p>
                  {r.rejection_reason && <p className="text-xs text-red-500">{r.rejection_reason}</p>}
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" disabled={actionLoading === r.id} onClick={() => action(r.id, 'approve')}>
                        {actionLoading === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" disabled={actionLoading === r.id} onClick={() => { setRejecting(r); setRejectReason(''); setActionErr('') }}>
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Employee', 'Category', 'Description', 'Amount', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No records found</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.employee_name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.category_name ?? '—'}</td>
                  <td className="px-4 py-2 max-w-[180px] truncate text-gray-700" title={r.description}>{r.description}</td>
                  <td className="px-4 py-2 font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{fmtDate(r.expense_date)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                    {r.rejection_reason && (
                      <p className="text-xs text-red-500 mt-0.5 max-w-[140px] truncate" title={r.rejection_reason}>
                        {r.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
                          disabled={actionLoading === r.id}
                          onClick={() => action(r.id, 'approve')}
                        >
                          {actionLoading === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle size={14} />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                          disabled={actionLoading === r.id}
                          onClick={() => { setRejecting(r); setRejectReason(''); setActionErr('') }}
                        >
                          <XCircle size={14} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={() => setRejecting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="font-semibold">Reject Expense</DialogTitle>
          {rejecting && (
            <p className="text-sm text-gray-500">
              {rejecting.employee_name} — {rejecting.description} — {fmtCurrency(rejecting.amount)}
            </p>
          )}
          {actionErr && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{actionErr}</p>}
          <div className="space-y-1">
            <Label>Rejection Reason</Label>
            <Input
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason…"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => rejecting && action(rejecting.id, 'reject', rejectReason)}
              disabled={!rejectReason.trim() || actionLoading === rejecting?.id}
            >
              {actionLoading === rejecting?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </Button>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
