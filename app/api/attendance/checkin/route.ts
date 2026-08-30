import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireRole, isResponse } from '@/lib/auth/authorize'
import { parseBody, attendanceGpsSchema } from '@/lib/validation'
import { checkIn } from '@/lib/modules/attendance/service'
import { ServiceError } from '@/lib/modules/errors'

// Max allowed GPS accuracy in meters — above this we reject (cell tower / wifi triangulation)
const MAX_ACCURACY_METERS = 200

export async function POST(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, attendanceGpsSchema)
  if (!parsed.ok) return parsed.response
  const { gps_lat, gps_lng, gps_accuracy } = parsed.data

  // Reject if no GPS provided at all
  if (gps_lat == null || gps_lng == null) {
    return NextResponse.json(
      { error: 'Location is required to check in. Please enable GPS and try again.' },
      { status: 400 },
    )
  }

  // Reject if accuracy is too low (cell tower / wifi — likely spoofed or no real GPS)
  if (gps_accuracy != null && gps_accuracy > MAX_ACCURACY_METERS) {
    return NextResponse.json(
      { error: `Location accuracy too low (${Math.round(gps_accuracy)}m). Enable GPS and move to an open area, then try again.` },
      { status: 400 },
    )
  }

  try {
    const record = await checkIn(db, {
      userId: actor.id,
      branchId: actor.branch_id,
      gpsLat: gps_lat,
      gpsLng: gps_lng,
      gpsAccuracy: gps_accuracy,
    })
    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}

