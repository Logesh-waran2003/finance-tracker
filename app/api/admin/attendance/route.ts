import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employee_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  const status = url.searchParams.get('status')

  const conditions: ReturnType<typeof eq>[] = []

  // Branch isolation
  if (actor.branch_id) {
    conditions.push(eq(attendance.branch_id, actor.branch_id) as any)
  }

  if (employeeId) conditions.push(eq(attendance.employee_id, employeeId) as any)
  if (start) conditions.push(gte(attendance.date, start) as any)
  if (end) conditions.push(lte(attendance.date, end) as any)
  if (status) conditions.push(eq(attendance.status, status as any) as any)

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
