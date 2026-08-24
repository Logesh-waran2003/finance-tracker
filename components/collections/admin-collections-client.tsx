'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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

interface Agent { id: string; full_name: string }

const STATUS_STYLE: Record<CollectionStatus, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const MODE_LABEL: Record<PaymentMode, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', OTHER: 'Other',
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatusBadge({ status }: { status: CollectionStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

function exportCSV(rows: AdminCollectionRow[]) {
  const headers = ['#', 'Customer', 'Agent', 'Amount', 'Mode', 'Reference', 'Status', 'Date', 'Confirmed At', 'Rejected Reason']
  const csvRows = rows.map(r => [
    r.collection_number ?? '',
    r.customer_name ?? '',
    r.agent_name ?? '',
    r.amount,
    r.payment_mode,
    r.payment_reference ?? '',
    r.status,
    r.collected_at ? format(new Date(r.collected_at), 'yyyy-MM-dd HH:mm') : '',
    r.confirmed_at ? format(new Date(r.confirmed_at), 'yyyy-MM-dd HH:mm') : '',
    r.rejected_reason ?? '',
  ])
  const csv = [headers, ...csvRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
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
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function fetchRows() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (agentFilter !== 'ALL') params.set('agent_id', agentFilter)
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    const res = await fetch(`/api/admin/collections?${params}`)
    const data = await res.json()
    setLoading(false)
    if (res.ok) setRows(data)
  }

  async function confirm(id: string) {
    setActioning(id)
    const res = await fetch(`/api/admin/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    })
    const data = await res.json()
    setActioning(null)
    if (!res.ok) { toast.error(data.error ?? 'Failed to confirm'); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'CONFIRMED', confirmed_at: data.confirmed_at } : r))
    toast.success('Collection confirmed')
  }

  async function reject() {
    if (!rejectTarget) return
    if (!rejectReason.trim()) { toast.error('Enter a rejection reason'); return }
    setActioning(rejectTarget)
    const res = await fetch(`/api/admin/collections/${rejectTarget}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
    })
    const data = await res.json()
    setActioning(null)
    if (!res.ok) { toast.error(data.error ?? 'Failed to reject'); return }
    setRows(prev => prev.map(r => r.id === rejectTarget ? { ...r, status: 'REJECTED', rejected_reason: rejectReason.trim() } : r))
    toast.success('Collection rejected')
    setRejectTarget(null)
    setRejectReason('')
  }

  const pendingCount = rows.filter(r => r.status === 'PENDING').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-yellow-600 mt-0.5">{pendingCount} pending review</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV(rows)}>
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'ALL')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agent</Label>
              <Select value={agentFilter} onValueChange={v => setAgentFilter(v ?? 'ALL')}>
                <SelectTrigger><SelectValue placeholder="All agents" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Agents</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={fetchRows} disabled={loading}>
            {loading && <Loader2 size={13} className="animate-spin mr-1.5" />}
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#', 'Customer', 'Agent', 'Amount', 'Mode', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No collections found
                  </td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">
                    {row.collection_number ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{row.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.agent_name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {fmt(parseFloat(row.amount))}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {MODE_LABEL[row.payment_mode] ?? row.payment_mode}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                    {row.status === 'REJECTED' && row.rejected_reason && (
                      <p className="text-xs text-red-400 mt-0.5 max-w-[160px] truncate" title={row.rejected_reason}>
                        {row.rejected_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {row.collected_at ? format(new Date(row.collected_at), 'dd MMM, hh:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'PENDING' && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                          disabled={actioning === row.id}
                          onClick={() => confirm(row.id)}
                        >
                          {actioning === row.id ? <Loader2 size={11} className="animate-spin" /> : 'Confirm'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          disabled={actioning === row.id}
                          onClick={() => { setRejectTarget(row.id); setRejectReason('') }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={v => { if (!v) { setRejectTarget(null); setRejectReason('') } }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Reject Collection</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Provide a reason — this will be visible to the agent.
          </DialogDescription>
          <div className="space-y-3 mt-2">
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Amount mismatch, wrong customer…"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setRejectTarget(null); setRejectReason('') }}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectReason.trim() || !!actioning}
                onClick={reject}
              >
                {actioning ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
