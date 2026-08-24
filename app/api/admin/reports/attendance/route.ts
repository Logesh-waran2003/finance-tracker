import { auth } from '@/auth'
import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import type { Session } from 'next-auth'

function csv(rows: string[][]): string {
  return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

function fmtDT(d: Date | null) {
  if (!d) return ''
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const agent_id = url.searchParams.get('agent_id')

  const conditions: any[] = []
  if (from) conditions.push(gte(attendance.date, from))
  if (to) conditions.push(lte(attendance.date, to))
  if (agent_id) conditions.push(eq(attendance.employee_id, agent_id))

  const rows = await db.select({
    full_name: profiles.full_name,
    employee_code: profiles.employee_code,
    date: attendance.date,
    status: attendance.status,
    check_in_at: attendance.check_in_at,
    check_out_at: attendance.check_out_at,
    total_hours: attendance.total_hours,
    notes: attendance.notes,
    check_in_gps_lat: attendance.check_in_gps_lat,
    check_in_gps_lng: attendance.check_in_gps_lng,
    corrected_at: attendance.corrected_at,
  }).from(attendance)
    .leftJoin(profiles, eq(attendance.employee_id, profiles.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(attendance.date))

  const headers = ['Employee', 'Code', 'Date', 'Status', 'Check-in', 'Check-out', 'Total Hours', 'GPS', 'Corrected At', 'Notes']
  const data = rows.map(r => [
    r.full_name ?? '',
    r.employee_code ?? '',
    r.date,
    r.status,
    fmtDT(r.check_in_at),
    fmtDT(r.check_out_at),
    r.total_hours ?? '',
    r.check_in_gps_lat ? `${r.check_in_gps_lat},${r.check_in_gps_lng}` : '',
    fmtDT(r.corrected_at),
    r.notes ?? '',
  ])

  const body = csv([headers, ...data])
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="attendance-report.csv"`,
    },
  })
}
