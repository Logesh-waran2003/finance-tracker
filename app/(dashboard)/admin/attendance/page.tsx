import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { AdminAttendanceClient } from '@/components/attendance/admin-attendance-client'
import type { Session } from 'next-auth'

export default async function AdminAttendancePage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  // Default: current month
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

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

  return <AdminAttendanceClient initial={initial as any} employees={employees} />
}
