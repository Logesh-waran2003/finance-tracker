'use client'

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { MapPin, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

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

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT:  { label: 'Present',   className: 'bg-green-100 text-green-700' },
  ABSENT:   { label: 'Absent',    className: 'bg-red-100 text-red-600' },
  LATE:     { label: 'Late',      className: 'bg-yellow-100 text-yellow-700' },
  HALF_DAY: { label: 'Half Day',  className: 'bg-orange-100 text-orange-700' },
  LEAVE:    { label: 'Leave',     className: 'bg-blue-100 text-blue-700' },
  WEEK_OFF: { label: 'Week Off',  className: 'bg-gray-100 text-gray-600' },
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ABSENT
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function fmtTime(ts: string | null) {
  if (!ts) return '—'
  return format(new Date(ts), 'hh:mm a')
}

function fmtHours(h: string | null) {
  if (!h) return '—'
  const n = parseFloat(h)
  const hrs = Math.floor(n)
  const mins = Math.round((n - hrs) * 60)
  return `${hrs}h ${mins}m`
}

type GpsState = 'idle' | 'acquiring' | 'ready' | 'denied'

export function AttendanceClient({ today, todayRecord: initial, history: initialHistory }: Props) {
  const [record, setRecord] = useState<AttendanceRecord | null>(initial)
  const [history, setHistory] = useState<AttendanceRecord[]>(initialHistory)
  const [gpsState, setGpsState] = useState<GpsState>('idle')
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [loading, setLoading] = useState<'checkin' | 'checkout' | null>(null)

  const acquireGps = useCallback((): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      setGpsState('acquiring')
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
          setGps(loc)
          setGpsState('ready')
          resolve(loc)
        },
        () => {
          setGpsState('denied')
          toast.error('Location access is off. Enable it in your browser: Settings → Privacy & Security → Location → Allow', {
            duration: 6000,
          })
          resolve(null)
        },
        { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
      )
    })
  }, [])

  async function handleCheckin() {
    setLoading('checkin')
    const loc = await acquireGps()
    const res = await fetch('/api/attendance/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gps_lat: loc?.lat, gps_lng: loc?.lng, gps_accuracy: loc?.accuracy }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Check-in failed'); setLoading(null); return }
    setRecord(data)
    setHistory(prev => {
      const idx = prev.findIndex(r => r.date === today)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [data, ...prev]
    })
    toast.success('Checked in successfully')
    setLoading(null)
  }

  async function handleCheckout() {
    setLoading('checkout')
    const loc = await acquireGps()
    const res = await fetch('/api/attendance/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gps_lat: loc?.lat, gps_lng: loc?.lng, gps_accuracy: loc?.accuracy }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Check-out failed'); setLoading(null); return }
    setRecord(data)
    setHistory(prev => {
      const idx = prev.findIndex(r => r.date === today)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [data, ...prev]
    })
    toast.success('Checked out successfully')
    setLoading(null)
  }

  const checkedIn = !!record?.check_in_at
  const checkedOut = !!record?.check_out_at
  const canCheckin = !checkedIn
  const canCheckout = checkedIn && !checkedOut

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">My Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(today + 'T00:00:00'), 'EEEE, dd MMMM yyyy')}
        </p>
      </div>

      {/* Today card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Today&apos;s Status</p>
              <StatusBadge status={record?.status ?? 'ABSENT'} />
            </div>
            {gpsState === 'acquiring' && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Getting location…
              </span>
            )}
            {gpsState === 'denied' && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <XCircle size={12} /> Location unavailable
              </span>
            )}
            {gpsState === 'ready' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <MapPin size={12} /> Location captured
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Check In</p>
              <p className="font-medium mt-0.5">{fmtTime(record?.check_in_at ?? null)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Check Out</p>
              <p className="font-medium mt-0.5">{fmtTime(record?.check_out_at ?? null)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Total Hours</p>
              <p className="font-medium mt-0.5">{fmtHours(record?.total_hours ?? null)}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              onClick={handleCheckin}
              disabled={!canCheckin || loading !== null}
              className="flex-1"
            >
              {loading === 'checkin' ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <CheckCircle2 size={16} className="mr-2" />
              )}
              Check In
            </Button>
            <Button
              variant="outline"
              onClick={handleCheckout}
              disabled={!canCheckout || loading !== null}
              className="flex-1"
            >
              {loading === 'checkout' ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Clock size={16} className="mr-2" />
              )}
              Check Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History table */}
      <div>
        <h2 className="text-base font-medium mb-3">Last 30 Days</h2>
        <Card>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Date', 'Check In', 'Check Out', 'Hours', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No attendance records</td>
                    </tr>
                  )}
                  {history.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {format(new Date(row.date + 'T00:00:00'), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtTime(row.check_in_at)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtTime(row.check_out_at)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtHours(row.total_hours)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden space-y-3 p-3">
              {history.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No attendance records</p>}
              {history.map(row => (
                <Card key={row.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{format(new Date(row.date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Check In</p>
                        <p className="font-medium">{fmtTime(row.check_in_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Check Out</p>
                        <p className="font-medium">{fmtTime(row.check_out_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Hours</p>
                        <p className="font-medium">{fmtHours(row.total_hours)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
