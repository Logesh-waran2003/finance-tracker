import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { AdminAttendanceClient } from '@/components/attendance/admin-attendance-client'

export default async function AdminAttendancePage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/dashboard')

  // Default: current month. Built from local parts — `toISOString()` on a
  // local midnight rolls the date back a day in IST, which silently dropped
  // today's rows from the first page load.
  const isoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  const start = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const end = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  const [initial, employees] = await Promise.all([
    db.select({
      id: attendance.id,
      employee_id: attendance.employee_id,
      full_name: profiles.full_name,
      employee_code: profiles.employee_code,
      date: attendance.date,
      check_in_at: attendance.check_in_at,
      check_out_at: attendance.check_out_at,
      total_hours: attendance.total_hours,
      status: attendance.status,
      notes: attendance.notes,
      check_in_gps_lat: attendance.check_in_gps_lat,
      check_in_gps_lng: attendance.check_in_gps_lng,
      check_in_gps_accuracy: attendance.check_in_gps_accuracy,
      corrected_by: attendance.corrected_by,
      corrected_at: attendance.corrected_at,
    }).from(attendance)
      .leftJoin(profiles, eq(attendance.employee_id, profiles.id))
      .where(and(gte(attendance.date, start), lte(attendance.date, end)))
      .orderBy(desc(attendance.date))
      .limit(200),

    db.select({ id: profiles.id, full_name: profiles.full_name, employee_code: profiles.employee_code })
      .from(profiles)
      .where(eq(profiles.is_active, true)),
  ])

  const serialized = initial.map(r => ({
    ...r,
    check_in_at: r.check_in_at?.toISOString() ?? null,
    check_out_at: r.check_out_at?.toISOString() ?? null,
    corrected_at: r.corrected_at?.toISOString() ?? null,
  }))

  return <AdminAttendanceClient initial={serialized} employees={employees} />
}
