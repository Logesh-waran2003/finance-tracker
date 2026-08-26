import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const { id } = await params

  const rows = await db.execute(sql`
    SELECT
      pen.id,
      pen.loan_id,
      pen.schedule_id,
      pen.penalty_amount,
      pen.is_waived,
      pen.waived_amount,
      pen.waived_by,
      pen.waived_at,
      pen.waiver_reason,
      pen.created_at,
      ls.scheduled_date
    FROM loan_penalties pen
    JOIN loan_schedules ls ON ls.id = pen.schedule_id
    WHERE pen.loan_id = ${id}
    ORDER BY ls.scheduled_date ASC
  `) as unknown as any[]

  return NextResponse.json(rows)
}
