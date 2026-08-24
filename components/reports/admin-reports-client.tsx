'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Loader2, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Agent { id: string; full_name: string }

type ReportType = 'collections' | 'attendance' | 'expenses' | 'reconciliation' | 'dues'

const REPORTS: { type: ReportType; label: string; desc: string }[] = [
  { type: 'collections', label: 'Collections Report', desc: 'All collections with agent, customer, amount, mode, status' },
  { type: 'attendance', label: 'Attendance Report', desc: 'Daily attendance for all employees with hours and status' },
  { type: 'expenses', label: 'Expenses Report', desc: 'Employee expenses with category, amount, approval status' },
  { type: 'reconciliation', label: 'Reconciliation Report', desc: 'Agent cash reconciliation history with differences' },
  { type: 'dues', label: 'Outstanding Dues', desc: 'All open dues per customer with outstanding amounts' },
]

function defaultFrom() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

function defaultTo() {
  return new Date().toISOString().split('T')[0]
}

export function AdminReportsClient({ agents }: { agents: Agent[] }) {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())
  const [agentId, setAgentId] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState<ReportType | null>(null)

  async function downloadReport(type: ReportType) {
    setLoading(type)
    try {
      const params = new URLSearchParams({ from, to })
      if (agentId !== 'ALL') params.set('agent_id', agentId)
      if (status !== 'ALL') params.set('status', status)

      const res = await fetch(`/api/admin/reports/${type}?${params}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Failed to generate report')
        setLoading(null)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report-${from}-to-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${type} report downloaded`)
    } catch {
      toast.error('Download failed')
    }
    setLoading(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Export data as CSV for the selected date range</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agent / Employee</Label>
              <Select value={agentId} onValueChange={v => setAgentId(v || 'ALL')}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v || 'ALL')}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map(r => (
          <Card key={r.type} className="hover:border-blue-200 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-7 text-xs"
                  disabled={loading !== null}
                  onClick={() => downloadReport(r.type)}
                >
                  {loading === r.type
                    ? <Loader2 size={12} className="animate-spin mr-1" />
                    : <Download size={12} className="mr-1" />}
                  {loading === r.type ? 'Generating...' : 'Download CSV'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
