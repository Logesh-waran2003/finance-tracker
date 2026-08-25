'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Search, Pencil, Download } from 'lucide-react'

interface AttendanceRow {
  id: string
  employee_id: string
  full_name: string | null
  employee_code: string | null
  date: string
  check_in_at: Date | string | null
  check_out_at: Date | string | null
  total_hours: string | null
  status: string
  notes: string | null
  check_in_gps_lat: string | null
  check_in_gps_lng: string | null
  corrected_by: string | null
  corrected_at: Date | string | null
}

interface Employee { id: string; full_name: string; employee_code: string | null }

const STATUS_COLOR: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT: 'bg-gray-100 text-gray-500',
  LATE: 'bg-yellow-100 text-yellow-700',
  HALF_DAY: 'bg-orange-100 text-orange-700',
  LEAVE: 'bg-blue-100 text-blue-700',
  WEEK_OFF: 'bg-purple-100 text-purple-700',
}

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'WEEK_OFF']

function fmtTime(ts: Date | string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(start), end: fmt(end) }
}

export function AdminAttendanceClient({ initial, employees }: {
  initial: AttendanceRow[]
  employees: Employee[]
}) {
  const defaultRange = getMonthRange()
  const [rows, setRows] = useState<AttendanceRow[]>(initial)
  const [from, setFrom] = useState(defaultRange.start)
  const [to, setTo] = useState(defaultRange.end)
  const [empFilter, setEmpFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)

  // Correction dialog
  const [correcting, setCorrecting] = useState<AttendanceRow | null>(null)
  const [corrForm, setCorrForm] = useState({ status: '', check_in_at: '', check_out_at: '', notes: '' })
  const [corrSaving, setCorrSaving] = useState(false)
  const [corrErr, setCorrErr] = useState('')

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({ start: from, end: to })
    if (empFilter !== 'ALL') params.set('employee_id', empFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    const res = await fetch(`/api/admin/attendance?${params}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  function openCorrect(row: AttendanceRow) {
    setCorrecting(row)
    setCorrForm({
      status: row.status,
      check_in_at: row.check_in_at ? new Date(row.check_in_at).toISOString().slice(0, 16) : '',
      check_out_at: row.check_out_at ? new Date(row.check_out_at).toISOString().slice(0, 16) : '',
      notes: row.notes ?? '',
    })
    setCorrErr('')
  }

  async function saveCorrection() {
    if (!correcting) return
    setCorrSaving(true); setCorrErr('')
    const res = await fetch(`/api/admin/attendance/${correcting.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: corrForm.status || undefined,
        check_in_at: corrForm.check_in_at || null,
        check_out_at: corrForm.check_out_at || null,
        notes: corrForm.notes || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setCorrErr(data.error ?? 'Failed'); setCorrSaving(false); return }
    setRows(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r))
    setCorrecting(null); setCorrSaving(false)
  }

  function exportCSV() {
    const header = ['Employee', 'Code', 'Date', 'Check-in', 'Check-out', 'Hours', 'Status', 'GPS']
    const rowData = filtered.map(r => [
      r.full_name ?? '', r.employee_code ?? '', r.date,
      fmtTime(r.check_in_at), fmtTime(r.check_out_at),
      r.total_hours ?? '', r.status,
      r.check_in_gps_lat ? 'Yes' : 'No',
    ])
    const csv = [header, ...rowData].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `attendance-${from}-to-${to}.csv`
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
        <h1 className="text-xl font-semibold">Attendance (Admin)</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download size={14} className="mr-1" />Export CSV
        </Button>
      </div>

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
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
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
              <Card key={r.id} className={r.corrected_by ? 'border-yellow-200' : ''}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.full_name ?? '—'}</p>
                      {r.employee_code && <p className="text-xs text-gray-400">{r.employee_code}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status.replace('_', ' ')}{r.corrected_by ? ' ✎' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs text-gray-500">Date</p><p className="font-medium text-xs">{fmtDate(r.date)}</p></div>
                    <div><p className="text-xs text-gray-500">Check-in</p><p className="font-medium text-xs">{fmtTime(r.check_in_at)}</p></div>
                    <div><p className="text-xs text-gray-500">Check-out</p><p className="font-medium text-xs">{fmtTime(r.check_out_at)}</p></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{r.total_hours ? `${r.total_hours}h` : '—'} {r.check_in_gps_lat ? '📍' : ''}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openCorrect(r)}><Pencil size={14} /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Employee', 'Date', 'Check-in', 'Check-out', 'Hours', 'Status', 'GPS', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No records found</td></tr>}
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.corrected_by ? 'bg-yellow-50/40' : ''}`}>
                    <td className="px-4 py-2">
                      <p className="font-medium">{r.full_name ?? '—'}</p>
                      {r.employee_code && <p className="text-xs text-gray-400">{r.employee_code}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2">{fmtTime(r.check_in_at)}</td>
                    <td className="px-4 py-2">{fmtTime(r.check_out_at)}</td>
                    <td className="px-4 py-2">{r.total_hours ? `${r.total_hours}h` : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                      {r.corrected_by && <span className="ml-1 text-xs text-yellow-600">✎</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.check_in_gps_lat ? '📍' : '—'}</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm" onClick={() => openCorrect(r)}><Pencil size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Correction dialog */}
      <Dialog open={!!correcting} onOpenChange={() => setCorrecting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="font-semibold">Correct Attendance</DialogTitle>
          {correcting && <p className="text-sm text-gray-500">{correcting.full_name} — {fmtDate(correcting.date)}</p>}
          {corrErr && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{corrErr}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label>Status</Label>
              <Select value={corrForm.status} onValueChange={v => setCorrForm(f => ({ ...f, status: v || f.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Check-in time</Label><Input type="datetime-local" value={corrForm.check_in_at} onChange={e => setCorrForm(f => ({ ...f, check_in_at: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Check-out time</Label><Input type="datetime-local" value={corrForm.check_out_at} onChange={e => setCorrForm(f => ({ ...f, check_out_at: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={corrForm.notes} onChange={e => setCorrForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveCorrection} disabled={corrSaving}>{corrSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Correction'}</Button>
            <Button variant="outline" onClick={() => setCorrecting(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
