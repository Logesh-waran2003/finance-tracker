'use client'

/**
 * One day of loan installments across every agent.
 *
 * Expected is amber (money still to come in), collected is green (money that
 * has arrived), missed is red. Getting those three the wrong way round would
 * tell an admin a bad day was a good one.
 */

import { useState } from 'react'
import { CalendarX2, Coins, Loader2, TrendingUp, TriangleAlert } from 'lucide-react'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
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
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGet } from '@/lib/api-client'
import { labels, type LabelKey } from '@/lib/i18n'

export interface MonitoringRow {
  customer_name: string
  agent_name: string
  loan_number: string
  daily_due: string
  paid: string | null
  penalty: string | null
  schedule_status: string
  principal_outstanding: string
}

export interface MonitoringAgent {
  id: string
  full_name: string
}

export interface MonitoringSummary {
  /**
   * Money as a string from the server page (summed in integer paise) or as a
   * number from the JSON API. <Money> takes either and formats from the value
   * it is given — nothing here parses it for display.
   */
  expected: string | number
  collected: string | number
  pending: number
  missed: number
}

interface Props {
  initialRows: MonitoringRow[]
  initialDate: string
  agents: MonitoringAgent[]
  summary: MonitoringSummary
}

const STATUS_FILTERS: { value: string; labelKey: LabelKey }[] = [
  { value: '', labelKey: 'filterAll' },
  { value: 'PENDING', labelKey: 'statusPending' },
  { value: 'PAID', labelKey: 'statusPaid' },
  { value: 'MISSED', labelKey: 'missed' },
]

/**
 * MISSED is not in the canonical status map, so it would render as a grey
 * "unknown". OVERDUE says the same thing to an admin and is red.
 */
function badgeStatus(scheduleStatus: string): string {
  return scheduleStatus?.toUpperCase() === 'MISSED' ? 'OVERDUE' : scheduleStatus
}

export default function AdminLoanMonitoringClient({
  initialRows,
  initialDate,
  agents,
  summary: initialSummary,
}: Props) {
  const [rows, setRows] = useState<MonitoringRow[]>(initialRows)
  const [summary, setSummary] = useState<MonitoringSummary>(initialSummary)
  const [date, setDate] = useState(initialDate)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  async function load(nextDate: string, nextAgentId: string) {
    setLoading(true)
    const params = new URLSearchParams({ date: nextDate })
    if (nextAgentId) params.set('agent_id', nextAgentId)
    const res = await apiGet<{ rows: MonitoringRow[]; summary: MonitoringSummary }>(
      `/api/admin/loans/monitoring?${params.toString()}`
    )
    setLoading(false)
    // On failure the previous day's rows and totals stay on screen unchanged,
    // rather than blanking to zero and looking like a day with no collections.
    if (!res.ok) return
    setRows(res.data.rows ?? [])
    setSummary(res.data.summary ?? { expected: 0, collected: 0, pending: 0, missed: 0 })
  }

  const filtered = statusFilter
    ? rows.filter((r) => r.schedule_status?.toUpperCase() === statusFilter)
    : rows

  const columns: DataListColumn<MonitoringRow>[] = [
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.customer_name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.loan_number}</p>
        </div>
      ),
    },
    {
      key: 'agent',
      header: <Bi k="agent" />,
      cell: (r) => <span className="text-muted-foreground">{r.agent_name}</span>,
    },
    {
      key: 'paid',
      /**
       * The `paid` figure comes from a join that includes payments an admin has
       * NOT approved yet, so it is only green — money in — once the installment
       * itself is PAID. An unapproved amount is amber and says so; green there
       * would report cash as banked while the agent is still holding it.
       */
      header: <Bi k="paidAmount" />,
      cell: (r) => {
        if (!r.paid) return <span className="text-muted-foreground">—</span>
        const cleared = r.schedule_status?.toUpperCase() === 'PAID'
        return (
          <span className="flex flex-col items-end gap-0.5 md:items-start">
            <Money value={r.paid} size="caption" intent={cleared ? 'in' : 'owed'} />
            {cleared ? null : (
              <span className="text-xs text-warning-muted-foreground">
                <Bi k="awaitingApproval" />
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'penalty',
      header: <Bi k="penaltyAmount" />,
      cell: (r) =>
        r.penalty ? (
          <Money value={r.penalty} size="caption" intent="owed" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'principal',
      header: <Bi k="principalOutstanding" />,
      hideOnMobile: true,
      cell: (r) => <Money value={r.principal_outstanding} size="caption" intent="owed" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: (r) => <StatusBadge status={badgeStatus(r.schedule_status)} />,
    },
    {
      key: 'due',
      header: <Bi k="dueAmount" />,
      align: 'right',
      cell: (r) => <Money value={r.daily_due} size="row" intent="owed" />,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titleKey="loanMonitoring" subtitle={labels.collectionStatusForDay.en} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField labelKey="date" htmlFor="monitoring-date">
          <Input
            id="monitoring-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              load(e.target.value, agentId)
            }}
          />
        </FormField>
        <FormField labelKey="agent" htmlFor="monitoring-agent">
          <Select
            value={agentId}
            onValueChange={(v) => {
              const next = v ?? ''
              setAgentId(next)
              load(date, next)
            }}
          >
            <SelectTrigger id="monitoring-agent">
              <SelectValue placeholder={labels.allAgents.en} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{labels.allAgents.en}</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Coins}
          labelKey="expectedToday"
          value={summary.expected}
          intent="warning"
          captionKey="totalScheduled"
        />
        <StatTile
          icon={TrendingUp}
          labelKey="collected"
          value={summary.collected}
          intent="success"
          captionKey="paymentsReceived"
        />
        <StatTile
          icon={TriangleAlert}
          labelKey="pending"
          value={summary.pending}
          kind="count"
          intent="info"
          captionKey="stillToCollect"
        />
        <StatTile
          icon={CalendarX2}
          labelKey="missed"
          value={summary.missed}
          kind="count"
          intent={summary.missed > 0 ? 'danger' : 'neutral'}
          captionKey="notCollected"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value || 'all'}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
          >
            <Bi k={f.labelKey} />
          </Button>
        ))}
        {loading ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <DataList
        items={filtered}
        getKey={(r, i) => `${r.loan_number}-${i}`}
        columns={columns}
        loading={loading && rows.length === 0}
        empty={<EmptyState icon={CalendarX2} titleKey="noSchedulesForDate" />}
      />
    </div>
  )
}

export { AdminLoanMonitoringClient }
