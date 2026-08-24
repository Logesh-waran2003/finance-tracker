import { auth } from '@/auth'
import { db } from '@/lib/db'
import { attendance } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { gps_lat, gps_lng, gps_accuracy } = body

  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
  const employeeId = session.user.id

  const existing = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employee_id, employeeId), eq(attendance.date, today)))
    .limit(1)
    .then(r => r[0])

  if (!existing || !existing.check_in_at) {
    return NextResponse.json({ error: 'Not checked in' }, { status: 400 })
  }
  if (existing.check_out_at) {
    return NextResponse.json({ error: 'Already checked out' }, { status: 400 })
  }

  // DB trigger auto-calculates total_hours and updates status to PRESENT/HALF_DAY
  const [updated] = await db
    .update(attendance)
    .set({
      check_out_at: now,
      check_out_gps_lat: gps_lat != null ? String(gps_lat) : null,
      check_out_gps_lng: gps_lng != null ? String(gps_lng) : null,
      check_out_gps_accuracy: gps_accuracy != null ? String(gps_accuracy) : null,
      updated_at: now,
    })
    .where(eq(attendance.id, existing.id))
    .returning()

  return NextResponse.json(updated)
}
