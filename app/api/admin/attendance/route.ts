import { auth } from '@/auth'
import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import type { Session } from 'next-auth'

function requireAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!requireAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employee_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  const status = url.searchParams.get('status')

  const conditions: ReturnType<typeof eq>[] = []
  if (employeeId) conditions.push(eq(attendance.employee_id, employeeId))
  if (start) conditions.push(gte(attendance.date, start))
  if (end) conditions.push(lte(attendance.date, end))
  if (status) conditions.push(eq(attendance.status, status as any))

  const rows = await db
    .select({
      id: attendance.id,
      employee_id: attendance.employee_id,
      branch_id: attendance.branch_id,
      date: attendance.date,
      check_in_at: attendance.check_in_at,
      check_out_at: attendance.check_out_at,
      check_in_gps_lat: attendance.check_in_gps_lat,
      check_in_gps_lng: attendance.check_in_gps_lng,
      check_out_gps_lat: attendance.check_out_gps_lat,
      check_out_gps_lng: attendance.check_out_gps_lng,
      total_hours: attendance.total_hours,
      status: attendance.status,
      notes: attendance.notes,
      corrected_by: attendance.corrected_by,
      corrected_at: attendance.corrected_at,
      created_at: attendance.created_at,
      full_name: profiles.full_name,
      employee_code: profiles.employee_code,
    })
    .from(attendance)
    .leftJoin(profiles, eq(attendance.employee_id, profiles.id))
    .where(conditions.length ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined)
    .orderBy(desc(attendance.date))

  return NextResponse.json(rows)
}
