'use client'

import { useState } from 'react'
import {
  CalendarCheck,
  FileSpreadsheet,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { ActionButton } from '@/components/ui/action-button'
import { Bi } from '@/components/ui/bi'
import { Card, CardContent } from '@/components/ui/card'
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
import { apiGet } from '@/lib/api-client'
import { t, type LabelKey } from '@/lib/i18n'

interface Agent {
  id: string
  full_name: string
}

type ReportType = 'collections' | 'attendance' | 'expenses' | 'reconciliation' | 'dues'

interface ReportCard {
  type: ReportType
  icon: LucideIcon
  labelKey: LabelKey
  sublabelKey: LabelKey
}

const REPORTS: ReportCard[] = [
  {
    type: 'collections',
    icon: Wallet,
    labelKey: 'collectionsReport',
    sublabelKey: 'collectionsReportDesc',
  },
  {
    type: 'attendance',
    icon: CalendarCheck,
    labelKey: 'attendanceReport',
    sublabelKey: 'attendanceReportDesc',
  },
  {
    type: 'expenses',
    icon: Receipt,
    labelKey: 'expensesReport',
    sublabelKey: 'expensesReportDesc',
  },
  {
    type: 'reconciliation',
    icon: FileSpreadsheet,
    labelKey: 'reconciliationReport',
    sublabelKey: 'reconciliationReportDesc',
  },
  { type: 'dues', icon: Users, labelKey: 'duesReport', sublabelKey: 'duesReportDesc' },
]

const STATUS_FILTERS: { value: string; key: LabelKey }[] = [
  { value: 'ALL', key: 'allStatus' },
  { value: 'PENDING', key: 'statusPending' },
  { value: 'CONFIRMED', key: 'statusConfirmed' },
  { value: 'REJECTED', key: 'statusRejected' },
]

function isoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function defaultFrom() {
  const d = new Date()
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function AdminReportsClient({ agents }: { agents: Agent[] }) {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(isoDate(new Date()))
  const [agentId, setAgentId] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState<ReportType | null>(null)

  async function downloadReport(type: ReportType) {
    setLoading(type)
    const params = new URLSearchParams({ from, to })
    if (agentId !== 'ALL') params.set('agent_id', agentId)
    if (status !== 'ALL') params.set('status', status)

    // `res.blob()` cannot go through apiFetch, so the CSV is read as text and
    // the Blob is built here. apiFetch's body reader falls through to text
    // when the body is not JSON, which is exactly what a text/csv route sends.
    const res = await apiGet<string>(`/api/admin/reports/${type}?${params}`)
    setLoading(null)
    if (!res.ok) return

    if (typeof res.data !== 'string' || res.data.length === 0) {
      toast.error(t('reportFailed').en)
      return
    }

    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}-report-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('reportDownloaded').en)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titleKey="reports" subtitle={<Bi k="exportDataForRange" />} />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            <Bi k="reportFilters" />
          </h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField labelKey="from" htmlFor="rep-from">
              <Input
                id="rep-from"
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </FormField>
            <FormField labelKey="to" htmlFor="rep-to">
              <Input id="rep-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </FormField>
            <FormField labelKey="agentOrEmployee" htmlFor="rep-agent">
              <Select value={agentId} onValueChange={v => setAgentId(v ?? 'ALL')}>
                <SelectTrigger id="rep-agent">
                  <SelectValue>
                    {agentId === 'ALL' ? (
                      <Bi k="allEmployees" />
                    ) : (
                      (agents.find(a => a.id === agentId)?.full_name ?? '—')
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <Bi k="allEmployees" />
                  </SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField labelKey="status" htmlFor="rep-status">
              <Select value={status} onValueChange={v => setStatus(v ?? 'ALL')}>
                <SelectTrigger id="rep-status">
                  <SelectValue>
                    <Bi k={STATUS_FILTERS.find(o => o.value === status)?.key ?? 'allStatus'} />
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
        </CardContent>
      </Card>

      {/* One big tappable card per export, never a row of small links. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {REPORTS.map(r => (
          <ActionButton
            key={r.type}
            icon={r.icon}
            labelKey={r.labelKey}
            sublabelKey={loading === r.type ? 'generating' : r.sublabelKey}
            intent="neutral"
            size="lg"
            loading={loading === r.type}
            disabled={loading !== null}
            className="h-auto min-h-16 items-start border border-border py-3 md:w-full md:min-w-0"
            onClick={() => downloadReport(r.type)}
          />
        ))}
      </div>
    </div>
  )
}
