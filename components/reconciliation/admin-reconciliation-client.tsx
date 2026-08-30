'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Download, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ReconRow {
  id: string
  agent_id: string
  agent_name: string | null
  date: string
  cash_collected: string
  cash_submitted: string
  difference: string | null
  status: string
  notes: string | null
  verified_at: string | null
  rejection_reason: string | null
  created_at: string | null
}

interface Agent { id: string; full_name: string }

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-500',
  SUBMITTED: 'bg-yellow-100 text-yellow-700',
  VERIFIED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
}

export function AdminReconciliationClient({ initial, agents }: { initial: ReconRow[]; agents: Agent[] }) {
  const [rows, setRows] = useState<ReconRow[]>(initial)
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)

  const [rejectTarget, setRejectTarget] = useState<ReconRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSaving, setRejectSaving] = useState(false)

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (agentFilter !== 'ALL') params.set('agent_id', agentFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (from) params.set('start', from)
    if (to) params.set('end', to)
    const res = await fetch(`/api/admin/reconciliation?${params}`)
    if (res.ok) {
      const data = await res.json()
      setRows(data.map((r: any) => ({
        ...r,
        cash_collected: String(r.cash_collected),
        cash_submitted: String(r.cash_submitted),
        difference: r.difference ? String(r.difference) : null,
      })))
    }
    setLoading(false)
  }

  async function doAction(id: string, action: string, reason?: string) {
    const res = await fetch(`/api/admin/reconciliation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed'); return false }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: data.status, rejection_reason: data.rejection_reason ?? null } : r))
    return true
  }

  async function handleVerify(row: ReconRow) {
    const ok = await doAction(row.id, 'verify')
    if (ok) toast.success(`Reconciliation verified for ${row.agent_name}`)
  }

  async function handleRejectSubmit() {
    if (!rejectTarget || !rejectReason.trim()) { toast.error('Reason required'); return }
    setRejectSaving(true)
    const ok = await doAction(rejectTarget.id, 'reject', rejectReason.trim())
    if (ok) { toast.success('Reconciliation rejected'); setRejectTarget(null); setRejectReason('') }
    setRejectSaving(false)
  }

  function exportCSV() {
    const headers = ['Agent', 'Date', 'Collected', 'Submitted', 'Difference', 'Status']
    const data = filtered.map(r => [
      r.agent_name ?? '', r.date,
      r.cash_collected, r.cash_submitted,
      r.difference ?? '0', r.status,
    ])
    const csv = [headers, ...data].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'reconciliation.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  const filtered = rows.filter(r => {
    const matchAgent = agentFilter === 'ALL' || r.agent_id === agentFilter
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
    return matchAgent && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Settlement</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download size={14} className="mr-1" />CSV</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={agentFilter} onValueChange={v => setAgentFilter(v || 'ALL')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Agents" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Agents</SelectItem>
            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v || 'ALL')}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            {['ALL', 'PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'].map(s => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? 'All Status' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
        <Button size="sm" onClick={fetchData} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="sm:hidden space-y-3 p-3">
            {filtered.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No records</p>}
            {filtered.map(r => {
              const diff = parseFloat(r.difference ?? '0')
              return (
                <Card key={r.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{r.agent_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{r.date}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><p className="text-xs text-gray-500">Collected</p><p className="font-medium">₹{parseFloat(r.cash_collected).toLocaleString()}</p></div>
                      <div><p className="text-xs text-gray-500">Submitted</p><p className="font-medium">₹{parseFloat(r.cash_submitted).toLocaleString()}</p></div>
                      <div><p className="text-xs text-gray-500">Diff</p><p className={`font-medium ${diff === 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-orange-600'}`}>{diff === 0 ? '₹0' : `₹${Math.abs(diff).toLocaleString()} ${diff < 0 ? '▼' : '▲'}`}</p></div>
                    </div>
                    {r.rejection_reason && <p className="text-xs text-red-500">{r.rejection_reason}</p>}
                    {(r.status === 'SUBMITTED' || r.status === 'PENDING') && (
                      <div className="flex gap-2 pt-1">
                        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleVerify(r)}>
                          <CheckCircle2 size={13} className="mr-1" />Verify
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setRejectTarget(r); setRejectReason('') }}>
                          <XCircle size={13} className="mr-1" />Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Agent', 'Date', 'Collected', 'Submitted', 'Difference', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No records</td></tr>}
                {filtered.map(r => {
                  const diff = parseFloat(r.difference ?? '0')
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{r.agent_name ?? '—'}</td>
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2">₹{parseFloat(r.cash_collected).toLocaleString()}</td>
                      <td className="px-4 py-2">₹{parseFloat(r.cash_submitted).toLocaleString()}</td>
                      <td className={`px-4 py-2 font-medium ${diff === 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {diff === 0 ? '₹0' : `₹${Math.abs(diff).toLocaleString()} ${diff < 0 ? '▼' : '▲'}`}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>
                          {r.status}
                        </span>
                        {r.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{r.rejection_reason}</p>}
                      </td>
                      <td className="px-4 py-2">
                        {(r.status === 'SUBMITTED' || r.status === 'PENDING') && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleVerify(r)}>
                              <CheckCircle2 size={14} />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { setRejectTarget(r); setRejectReason('') }}>
                              <XCircle size={14} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="font-semibold">Reject Reconciliation</DialogTitle>
          {rejectTarget && (
            <DialogDescription className="text-sm text-gray-600">
              {rejectTarget.agent_name} — {rejectTarget.date}
            </DialogDescription>
          )}
          <div className="space-y-2">
            <Label>Rejection Reason *</Label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={rejectSaving}>
              {rejectSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Reject
            </Button>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
