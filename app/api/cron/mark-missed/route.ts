import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { markMissedSchedules } from '@/lib/modules/loans/schedule-service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(request: Request) {
  // Auth: shared secret header (skip check if CRON_SECRET not set — dev mode)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = request.headers.get('x-cron-secret')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const result = await markMissedSchedules(db, {
      actorId: 'system',
      actorName: 'System Cron',
      actorEmail: 'cron@system',
    })

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
