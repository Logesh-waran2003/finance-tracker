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

  // IST hour to determine LATE (>= 10:00)
  const istHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10
  )
  const isLate = istHour >= 10

  const existing = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employee_id, employeeId), eq(attendance.date, today)))
    .limit(1)
    .then(r => r[0])

  if (existing) {
    if (existing.check_in_at) {
      return NextResponse.json({ error: 'Already checked in' }, { status: 400 })
    }
    const [updated] = await db
      .update(attendance)
      .set({
        check_in_at: now,
        status: isLate ? 'LATE' : 'PRESENT',
        check_in_gps_lat: gps_lat != null ? String(gps_lat) : null,
        check_in_gps_lng: gps_lng != null ? String(gps_lng) : null,
        check_in_gps_accuracy: gps_accuracy != null ? String(gps_accuracy) : null,
        updated_at: now,
      })
      .where(eq(attendance.id, existing.id))
      .returning()
    return NextResponse.json(updated)
  }

  const branchId = (session.user as any).branch_id ?? null
  const [record] = await db
    .insert(attendance)
    .values({
      employee_id: employeeId,
      branch_id: branchId,
      date: today,
      check_in_at: now,
      status: isLate ? 'LATE' : 'PRESENT',
      check_in_gps_lat: gps_lat != null ? String(gps_lat) : null,
      check_in_gps_lng: gps_lng != null ? String(gps_lng) : null,
      check_in_gps_accuracy: gps_accuracy != null ? String(gps_accuracy) : null,
    })
    .returning()

  return NextResponse.json(record, { status: 201 })
}
