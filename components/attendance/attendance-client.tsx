'use client'

import { useState, useCallback } from 'react'
import {
  CalendarClock,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { LocationDeniedDialog } from '@/components/ui/location-denied-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { ActionButton } from '@/components/ui/action-button'
import { StickyActionBar } from '@/components/ui/sticky-action-bar'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Bi } from '@/components/ui/bi'
import { apiPost, useOnlineStatus } from '@/lib/api-client'
import { formatDate, formatTime } from '@/lib/format'
import { t } from '@/lib/i18n'

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'WEEK_OFF'

interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in_at: string | null
  check_out_at: string | null
  total_hours: string | null
  status: AttendanceStatus
  check_in_gps_lat: string | null
  check_in_gps_lng: string | null
  check_out_gps_lat: string | null
  check_out_gps_lng: string | null
  notes: string | null
  created_at: string | null
  updated_at?: string | null
}

interface Props {
  today: string
  todayRecord: AttendanceRecord | null
  history: AttendanceRecord[]
}

/**
 * Hours are the hero number on this screen, so there is never an em-dash here.
 * A bold em-dash at 4xl renders as a solid black bar and reads as a broken
 * element; `0h 00m` reads as "nothing yet", which is the truth.
 */
function fmtHours(h: string | null): string {
  const n = h ? Number(h) : 0
  const value = Number.isFinite(n) && n > 0 ? n : 0
  const hrs = Math.floor(value)
  const mins = Math.round((value - hrs) * 60)
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
}

type GpsState = 'idle' | 'acquiring' | 'ready' | 'denied'
type GpsFix = { lat: number; lng: number; accuracy: number }

export function AttendanceClient({ today, todayRecord: initial, history: initialHistory }: Props) {
  const [record, setRecord] = useState<AttendanceRecord | null>(initial)
  const [history, setHistory] = useState<AttendanceRecord[]>(initialHistory)
  const [gpsState, setGpsState] = useState<GpsState>('idle')
  const [loading, setLoading] = useState<'checkin' | 'checkout' | null>(null)
  const [showLocationDenied, setShowLocationDenied] = useState(false)
  const online = useOnlineStatus()

  /**
   * Resolves the fix instead of only writing it to state.
   *
   * The caller MUST use the resolved value. Reading `gps` from state on the
   * next line always gives the value from the render that created the handler
   * — i.e. null — which is how collections shipped with every GPS column NULL
   * while the UI said "location captured". Do not "simplify" this.
   */
  const acquireGps = useCallback((): Promise<GpsFix | null> => {
    return new Promise(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsState('denied')
        resolve(null)
        return
      }
      setGpsState('acquiring')
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc: GpsFix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          setGpsState('ready')
          resolve(loc)
        },
        () => {
          setGpsState('denied')
          setShowLocationDenied(true)
          resolve(null)
        },
        { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
      )
    })
  }, [])

  function applyRecord(next: AttendanceRecord) {
    setRecord(next)
    setHistory(prev => {
      const idx = prev.findIndex(r => r.date === today)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = next
        return copy
      }
      return [next, ...prev]
    })
  }

  async function punch(kind: 'checkin' | 'checkout') {
    setLoading(kind)
    // Location never blocks the punch: a null fix still checks the agent in.
    const loc = await acquireGps()
    const res = await apiPost<AttendanceRecord>(`/api/attendance/${kind}`, {
      gps_lat: loc?.lat,
      gps_lng: loc?.lng,
      gps_accuracy: loc?.accuracy,
    })
    if (!res.ok) {
      setLoading(null)
      return
    }
    applyRecord(res.data)
    toast.success(t(kind === 'checkin' ? 'checkedIn' : 'checkedOut').en)
    setLoading(null)
  }

  const checkedIn = Boolean(record?.check_in_at)
  const checkedOut = Boolean(record?.check_out_at)
  const hours = fmtHours(record?.total_hours ?? null)

  const columns: DataListColumn<AttendanceRecord>[] = [
    {
      key: 'date',
      header: <Bi k="date" />,
      primary: true,
      cell: row => <span className="font-medium">{formatDate(row.date + 'T00:00:00')}</span>,
    },
    {
      key: 'checkIn',
      header: <Bi k="checkInTime" />,
      cell: row => <span className="tabular">{formatTime(row.check_in_at)}</span>,
    },
    {
      key: 'checkOut',
      header: <Bi k="checkOutTime" />,
      cell: row => <span className="tabular">{formatTime(row.check_out_at)}</span>,
    },
    {
      key: 'hours',
      header: <Bi k="totalHours" />,
      cell: row => <span className="tabular font-semibold">{fmtHours(row.total_hours)}</span>,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      align: 'right',
      cell: row => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titleKey="myAttendance" subtitle={formatDate(today + 'T00:00:00', 'long')} />

      {!online ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-warning-muted p-3 text-warning-muted-foreground">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 text-sm">
            <Bi k="offlineNow" className="font-semibold" />
            <p className="text-xs opacity-90">
              <Bi k="attendanceNeedsInternet" />
            </p>
          </div>
        </div>
      ) : null}

      {/* Hero — one number, one status, two times. */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
        <div className="flex items-center justify-between gap-3">
          <Bi k="todaysStatus" className="text-sm text-muted-foreground" />
          {record ? (
            <StatusBadge status={record.status} />
          ) : (
            <Bi k="notCheckedInYet" className="text-sm text-muted-foreground" />
          )}
        </div>

        <div>
          <Bi k="hoursWorked" className="text-sm text-muted-foreground" />
          <p className="tabular text-5xl leading-none font-bold tracking-tight">{hours}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted p-3">
            <Bi k="checkInTime" className="text-xs text-muted-foreground" />
            <p className="tabular mt-0.5 text-lg font-semibold">
              {record?.check_in_at ? formatTime(record.check_in_at) : '--:--'}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <Bi k="checkOutTime" className="text-xs text-muted-foreground" />
            <p className="tabular mt-0.5 text-lg font-semibold">
              {record?.check_out_at ? formatTime(record.check_out_at) : '--:--'}
            </p>
          </div>
        </div>

        {/* Location is a fact, never a blocker. */}
        <p className="flex items-center gap-1.5 text-xs">
          {gpsState === 'acquiring' ? (
            <>
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" />
              <Bi k="gpsAcquiring" className="text-muted-foreground" />
            </>
          ) : gpsState === 'ready' ? (
            <>
              <MapPin aria-hidden="true" className="size-3.5 text-success" />
              <Bi k="gpsCaptured" className="text-success" />
            </>
          ) : gpsState === 'denied' ? (
            <>
              <MapPinOff aria-hidden="true" className="size-3.5 text-warning-muted-foreground" />
              <Bi k="gpsSkippedNote" className="text-warning-muted-foreground" />
            </>
          ) : (
            <>
              <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <Bi k="gpsSavedOnCheckIn" className="text-muted-foreground" />
            </>
          )}
        </p>
      </section>

      {/* History */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          <Bi k="last30Days" />
        </h2>
        <DataList
          items={history}
          getKey={row => row.id}
          columns={columns}
          empty={
            <EmptyState
              icon={CalendarClock}
              titleKey="noAttendanceRecords"
              descriptionKey="noAttendanceHelp"
            />
          }
        />
      </section>

      {/* One action, never two competing ones. */}
      <StickyActionBar>
        {!checkedIn ? (
          <ActionButton
            size="lg"
            intent="success"
            icon={LogIn}
            labelKey="checkIn"
            loading={loading === 'checkin'}
            onClick={() => punch('checkin')}
          />
        ) : !checkedOut ? (
          <ActionButton
            size="lg"
            intent="warning"
            icon={LogOut}
            labelKey="checkOut"
            loading={loading === 'checkout'}
            onClick={() => punch('checkout')}
          />
        ) : (
          <ActionButton
            size="lg"
            intent="neutral"
            icon={CalendarClock}
            labelKey="workDone"
            sublabel={{ en: hours }}
            disabled
          />
        )}
      </StickyActionBar>

      <LocationDeniedDialog open={showLocationDenied} onClose={() => setShowLocationDenied(false)} />
    </div>
  )
}
