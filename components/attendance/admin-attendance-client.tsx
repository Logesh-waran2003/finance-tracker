'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Download, Loader2, Pencil, UserCheck, UserX } from 'lucide-react'
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
import { GMapsLink } from '@/components/ui/gmaps-link'
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiPatch } from '@/lib/api-client'
import { formatDate, formatTime, toNumber } from '@/lib/format'
import { statusLabel, t } from '@/lib/i18n'

interface AttendanceRow {
  id: string
  employee_id: string
  full_name: string | null
  employee_code: string | null
  date: string
  check_in_at: string | null
  check_out_at: string | null
  total_hours: string | null
  status: string
  notes: string | null
  check_in_gps_lat: string | null
  check_in_gps_lng: string | null
  check_in_gps_accuracy: string | null
  corrected_by: string | null
  corrected_at: string | null
}

interface Employee {
  id: string
  full_name: string
  employee_code: string | null
}

const STATUS_OPTIONS = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'HALF_DAY',
  'LEAVE',
  'WEEK_OFF',
] as const

interface CorrectionForm {
  status: string
  check_in_at: string
  check_out_at: string
  notes: string
}

const emptyCorrection: CorrectionForm = {
  status: '',
  check_in_at: '',
  check_out_at: '',
  notes: '',
}

function isoDate(d: Date): string {
  // Built from local parts, not toISOString(): in IST, `toISOString()` on a
  // local midnight rolls the date back one day.
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function monthRange() {
  const now = new Date()
  return {
    start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

function toLocalInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function AdminAttendanceClient({
  initial,
  employees,
}: {
  initial: AttendanceRow[]
  employees: Employee[]
}) {
  const defaultRange = monthRange()
  const [rows, setRows] = useState<AttendanceRow[]>(initial)
  const [from, setFrom] = useState(defaultRange.start)
  const [to, setTo] = useState(defaultRange.end)
  const [empFilter, setEmpFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)

  const [correcting, setCorrecting] = useState<AttendanceRow | null>(null)
  const [corrForm, setCorrForm] = useState<CorrectionForm>(emptyCorrection)
  const [corrSaving, setCorrSaving] = useState(false)
  const [corrError, setCorrError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      rows.filter(r => {
        const matchEmp = empFilter === 'ALL' || r.employee_id === empFilter
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
        return matchEmp && matchStatus
      }),
    [rows, empFilter, statusFilter],
  )

  const todayIso = isoDate(new Date())
  const presentToday = filtered.filter(
    r => r.date === todayIso && (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY'),
  ).length
  const absentToday = filtered.filter(r => r.date === todayIso && r.status === 'ABSENT').length

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams({ start: from, end: to })
    if (empFilter !== 'ALL') params.set('employee_id', empFilter)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    const res = await apiGet<AttendanceRow[]>(`/api/admin/attendance?${params}`)
    setLoading(false)
    if (!res.ok) return
    setRows(res.data)
  }

  function openCorrect(row: AttendanceRow) {
    setCorrecting(row)
    setCorrError(null)
    setCorrForm({
      status: row.status,
      check_in_at: toLocalInput(row.check_in_at),
      check_out_at: toLocalInput(row.check_out_at),
      notes: row.notes ?? '',
    })
  }

  function closeCorrect() {
    if (corrSaving) return
    setCorrecting(null)
    setCorrForm(emptyCorrection)
    setCorrError(null)
  }

  async function saveCorrection() {
    const target = correcting
    if (!target) return
    setCorrSaving(true)
    setCorrError(null)
    const res = await apiPatch<AttendanceRow>(`/api/admin/attendance/${target.id}`, {
      status: corrForm.status || undefined,
      check_in_at: corrForm.check_in_at ? new Date(corrForm.check_in_at).toISOString() : null,
      check_out_at: corrForm.check_out_at ? new Date(corrForm.check_out_at).toISOString() : null,
      // The route's schema accepts `notes` as an optional STRING, not null.
      // Sending null made every correction fail with a 400, so an empty box
      // sends an empty string, which is what clears the note.
      notes: corrForm.notes,
    })
    setCorrSaving(false)
    // Failure: the row keeps its previous values and the dialog stays open
    // with everything the admin typed.
    if (!res.ok) {
      setCorrError(res.error)
      return
    }
    setRows(prev => prev.map(r => (r.id === target.id ? { ...r, ...res.data } : r)))
    setCorrecting(null)
    setCorrForm(emptyCorrection)
    toast.success(t('attendanceCorrected').en)
  }

  function exportCSV() {
    const header = ['Employee', 'Code', 'Date', 'Check-in', 'Check-out', 'Hours', 'Status', 'GPS']
    const body = filtered.map(r => [
      r.full_name,
      r.employee_code,
      r.date,
      r.check_in_at ? formatTime(r.check_in_at) : '',
      r.check_out_at ? formatTime(r.check_out_at) : '',
      r.total_hours,
      r.status,
      r.check_in_gps_lat ? `${r.check_in_gps_lat},${r.check_in_gps_lng}` : '',
    ])
    const csv = [header, ...body].map(row => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: DataListColumn<AttendanceRow>[] = [
    {
      key: 'employee',
      header: <Bi k="employee" />,
      primary: true,
      cell: r => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.full_name ?? '—'}</p>
          {r.employee_code ? (
            <p className="truncate text-xs text-muted-foreground">{r.employee_code}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'date',
      header: <Bi k="date" />,
      cell: r => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.date)}</span>
      ),
    },
    {
      key: 'checkIn',
      header: <Bi k="checkInTime" />,
      cell: r => <span className="tabular">{r.check_in_at ? formatTime(r.check_in_at) : '—'}</span>,
    },
    {
      key: 'checkOut',
      header: <Bi k="checkOutTime" />,
      cell: r => (
        <span className="tabular">{r.check_out_at ? formatTime(r.check_out_at) : '—'}</span>
      ),
    },
    {
      key: 'hours',
      header: <Bi k="hours" />,
      align: 'right',
      cell: r => <span className="tabular">{r.total_hours ? `${r.total_hours}h` : '—'}</span>,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: r => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={r.status} />
          {r.corrected_by ? (
            <span className="inline-flex items-center gap-1 text-xs text-warning-muted-foreground">
              <Pencil aria-hidden="true" className="size-3" />
              <Bi k="corrected" />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'gps',
      header: <Bi k="gpsLocation" />,
      hideOnMobile: true,
      cell: r =>
        r.check_in_gps_lat && r.check_in_gps_lng ? (
          <div className="flex flex-col items-start gap-1">
            <GMapsLink query={`${r.check_in_gps_lat},${r.check_in_gps_lng}`} />
            {r.check_in_gps_accuracy ? (
              <span
                className={
                  toNumber(r.check_in_gps_accuracy) > 100
                    ? 'text-xs text-warning-muted-foreground'
                    : 'text-xs text-muted-foreground'
                }
              >
                <Bi k="gpsAccuracy" /> ±{Math.round(toNumber(r.check_in_gps_accuracy))}m
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: r => (
        <Button variant="outline" size="sm" onClick={() => openCorrect(r)}>
          <Pencil />
          <Bi k="edit" />
        </Button>
      ),
    },
  ]

  const renderCard = (r: AttendanceRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.full_name ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.employee_code ? `${r.employee_code} · ` : ''}
            {formatDate(r.date)}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">
            <Bi k="checkInTime" />
          </dt>
          <dd className="tabular">{r.check_in_at ? formatTime(r.check_in_at) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            <Bi k="checkOutTime" />
          </dt>
          <dd className="tabular">{r.check_out_at ? formatTime(r.check_out_at) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            <Bi k="hours" />
          </dt>
          <dd className="tabular">{r.total_hours ? `${r.total_hours}h` : '—'}</dd>
        </div>
      </dl>

      {r.corrected_by ? (
        <span className="inline-flex w-fit items-center gap-1 text-xs text-warning-muted-foreground">
          <Pencil aria-hidden="true" className="size-3" />
          <Bi k="corrected" />
        </span>
      ) : null}

      {r.check_in_gps_lat && r.check_in_gps_lng ? (
        <GMapsLink query={`${r.check_in_gps_lat},${r.check_in_gps_lng}`} />
      ) : null}

      <Button variant="outline" onClick={() => openCorrect(r)}>
        <Pencil />
        <Bi k="correctAttendance" />
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titleKey="attendance"
        action={
          <Button variant="outline" onClick={exportCSV}>
            <Download />
            <Bi k="exportCsv" />
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <StatTile
          icon={UserCheck}
          labelKey="presentToday"
          value={presentToday}
          kind="count"
          intent="success"
        />
        <StatTile
          icon={UserX}
          labelKey="absentToday"
          value={absentToday}
          kind="count"
          intent={absentToday > 0 ? 'danger' : 'neutral'}
        />
        <StatTile
          icon={CalendarDays}
          labelKey="allRecords"
          value={filtered.length}
          kind="count"
          intent="info"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormField labelKey="from" htmlFor="att-from">
              <Input
                id="att-from"
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </FormField>
            <FormField labelKey="to" htmlFor="att-to">
              <Input id="att-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </FormField>
            <FormField labelKey="employee" htmlFor="att-emp">
              <Select value={empFilter} onValueChange={v => setEmpFilter(v ?? 'ALL')}>
                <SelectTrigger id="att-emp">
                  <SelectValue>
                    {empFilter === 'ALL' ? (
                      <Bi k="allEmployees" />
                    ) : (
                      (employees.find(e => e.id === empFilter)?.full_name ?? '—')
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <Bi k="allEmployees" />
                  </SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField labelKey="status" htmlFor="att-status">
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'ALL')}>
                <SelectTrigger id="att-status">
                  <SelectValue>
                    {statusFilter === 'ALL' ? (
                      <Bi k="allStatus" />
                    ) : (
                      <Bi label={statusLabel(statusFilter)} />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <Bi k="allStatus" />
                  </SelectItem>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>
                      <Bi label={statusLabel(s)} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <Button onClick={fetchData} disabled={loading} className="md:self-start">
            {loading ? <Loader2 className="animate-spin" /> : null}
            <Bi k="applyFilters" />
          </Button>
        </CardContent>
      </Card>

      <DataList
        items={filtered}
        getKey={r => r.id}
        columns={columns}
        renderCard={renderCard}
        empty={<EmptyState icon={CalendarDays} titleKey="noAttendanceRecords" />}
      />

      {/* Manual correction — a real form, never a native prompt. */}
      <Dialog open={!!correcting} onOpenChange={open => { if (!open) closeCorrect() }}>
        <DialogContent>
          <DialogTitle>
            <Bi k="correctAttendance" />
          </DialogTitle>
          {correcting ? (
            <DialogDescription>
              {correcting.full_name ?? '—'} · {formatDate(correcting.date)}
            </DialogDescription>
          ) : null}

          <div className="flex flex-col gap-4">
            <FormField labelKey="status" htmlFor="corr-status" error={corrError}>
              <Select
                value={corrForm.status}
                onValueChange={v => setCorrForm(f => ({ ...f, status: v ?? f.status }))}
              >
                <SelectTrigger id="corr-status">
                  <SelectValue>
                    {corrForm.status ? <Bi label={statusLabel(corrForm.status)} /> : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>
                      <Bi label={statusLabel(s)} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField labelKey="checkInTime" htmlFor="corr-in">
              <Input
                id="corr-in"
                type="datetime-local"
                value={corrForm.check_in_at}
                onChange={e => setCorrForm(f => ({ ...f, check_in_at: e.target.value }))}
              />
            </FormField>

            <FormField labelKey="checkOutTime" htmlFor="corr-out">
              <Input
                id="corr-out"
                type="datetime-local"
                value={corrForm.check_out_at}
                onChange={e => setCorrForm(f => ({ ...f, check_out_at: e.target.value }))}
              />
            </FormField>

            <FormField labelKey="notesOptional" htmlFor="corr-notes">
              <Textarea
                id="corr-notes"
                rows={2}
                value={corrForm.notes}
                onChange={e => setCorrForm(f => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button
              size="lg"
              className="md:flex-1"
              disabled={corrSaving}
              onClick={saveCorrection}
            >
              {corrSaving ? <Loader2 className="animate-spin" /> : null}
              <Bi k="saveCorrection" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={corrSaving}
              onClick={closeCorrect}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
