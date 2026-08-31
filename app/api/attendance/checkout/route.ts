import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { requireRole, isResponse } from '@/lib/auth/authorize'
import { parseBody, attendanceGpsSchema } from '@/lib/validation'
import { checkOut } from '@/lib/modules/attendance/service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, attendanceGpsSchema)
  if (!parsed.ok) return parsed.response
  const { gps_lat, gps_lng, gps_accuracy } = parsed.data

  try {
    const record = await checkOut(db, {
      userId: actor.id,
      gpsLat: gps_lat,
      gpsLng: gps_lng,
      gpsAccuracy: gps_accuracy,
    })
    db.insert(auditLogs).values({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_email: actor.email,
      action: 'CHECK_OUT',
      entity_type: 'attendance',
      entity_id: record.id,
      after_data: { date: record.date, total_hours: record.total_hours ?? null },
      branch_id: actor.branch_id,
    }).catch(() => {})
    return NextResponse.json(record)
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
