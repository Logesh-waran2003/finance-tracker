import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { attendance } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { AttendanceClient } from '@/components/attendance/attendance-client'

function serializeRecord<T extends {
  check_in_at: Date | null
  check_out_at: Date | null
  corrected_at: Date | null
  created_at: Date | null
  updated_at: Date | null
}>(r: T) {
  return {
    ...r,
    check_in_at: r.check_in_at?.toISOString() ?? null,
    check_out_at: r.check_out_at?.toISOString() ?? null,
    corrected_at: r.corrected_at?.toISOString() ?? null,
    created_at: r.created_at?.toISOString() ?? null,
    updated_at: r.updated_at?.toISOString() ?? null,
  }
}

export default async function AttendancePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)

  const todayRaw = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employee_id, session.user.id), eq(attendance.date, today)))
    .limit(1)
    .then(r => r[0] ?? null)

  const historyRaw = await db
    .select()
    .from(attendance)
    .where(eq(attendance.employee_id, session.user.id))
    .orderBy(desc(attendance.date))
    .limit(30)

  const todayRecord = todayRaw ? serializeRecord(todayRaw) : null
  const history = historyRaw.map(serializeRecord)

  return (
    <AttendanceClient
      today={today}
      todayRecord={todayRecord as unknown as Parameters<typeof AttendanceClient>[0]['todayRecord']}
      history={history as unknown as Parameters<typeof AttendanceClient>[0]['history']}
    />
  )
}
