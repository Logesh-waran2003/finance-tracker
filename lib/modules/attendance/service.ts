/**
 * Attendance service — check-in and check-out business logic.
 * No NextRequest, no session — auth stays in the route layer.
 */
import { attendance } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { ServiceError } from '@/lib/modules/errors'

 
type AnyDB = { insert: (...a: any[]) => any; select: (...a: any[]) => any; update: (...a: any[]) => any }

export type CheckInParams = {
  userId: string
  branchId: string | null
  gpsLat?: number
  gpsLng?: number
  gpsAccuracy?: number
}

export type CheckOutParams = {
  userId: string
  gpsLat?: number
  gpsLng?: number
  gpsAccuracy?: number
}

/**
 * Records a check-in for today (IST).
 * - If a record for today already exists and has check_in_at → throws 400
 * - Late threshold: IST hour >= 10
 */
export async function checkIn(
  db: AnyDB,
  params: CheckInParams,
): Promise<typeof attendance.$inferSelect> {
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)

  const istHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10,
  )
  const isLate = istHour >= 10

  const existing = await (db as any)
    .select()
    .from(attendance)
    .where(and(eq(attendance.employee_id, params.userId), eq(attendance.date, today)))
    .limit(1)
    .then((r: any[]) => r[0])

  if (existing?.check_in_at) {
    throw new ServiceError('Already checked in', 400)
  }

  const gpsFields = {
    check_in_gps_lat: params.gpsLat != null ? String(params.gpsLat) : null,
    check_in_gps_lng: params.gpsLng != null ? String(params.gpsLng) : null,
    check_in_gps_accuracy: params.gpsAccuracy != null ? String(params.gpsAccuracy) : null,
  }

  if (existing) {
    const [updated] = await (db as any)
      .update(attendance)
      .set({
        check_in_at: now,
        status: isLate ? 'LATE' : 'PRESENT',
        ...gpsFields,
        updated_at: now,
      })
      .where(eq(attendance.id, existing.id))
      .returning()
    return updated
  }

  const [record] = await (db as any)
    .insert(attendance)
    .values({
      employee_id: params.userId,
      branch_id: params.branchId,
      date: today,
      check_in_at: now,
      status: isLate ? 'LATE' : 'PRESENT',
      ...gpsFields,
    })
    .returning()
  return record
}

/**
 * Records a check-out for today (IST).
 * - Requires an existing check-in record for today
 * - Throws if not checked in or already checked out
 */
export async function checkOut(
  db: AnyDB,
  params: CheckOutParams,
): Promise<typeof attendance.$inferSelect> {
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)

  const existing = await (db as any)
    .select()
    .from(attendance)
    .where(and(eq(attendance.employee_id, params.userId), eq(attendance.date, today)))
    .limit(1)
    .then((r: any[]) => r[0])

  if (!existing || !existing.check_in_at) {
    throw new ServiceError('Not checked in', 400)
  }
  if (existing.check_out_at) {
    throw new ServiceError('Already checked out', 400)
  }

  const [updated] = await (db as any)
    .update(attendance)
    .set({
      check_out_at: now,
      check_out_gps_lat: params.gpsLat != null ? String(params.gpsLat) : null,
      check_out_gps_lng: params.gpsLng != null ? String(params.gpsLng) : null,
      check_out_gps_accuracy: params.gpsAccuracy != null ? String(params.gpsAccuracy) : null,
      updated_at: now,
    })
    .where(eq(attendance.id, existing.id))
    .returning()

  return updated
}
