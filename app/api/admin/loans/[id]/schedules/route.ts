import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const statusFilter = status
    ? sql`AND ls.status = ${status}`
    : sql``

  const rows = await db.execute(sql`
    SELECT
      ls.id,
      ls.scheduled_date,
      ls.installment_amount,
      ls.status,
      ls.paid_at,
      lp.id               AS payment_id,
      lp.payment_number,
      lp.amount           AS paid_amount,
      lp.payment_mode,
      lp.payment_reference,
      lp.is_reversed,
      lp.created_at       AS paid_at_ts,
      p.full_name         AS agent_name,
      pen.id              AS penalty_id,
      pen.penalty_amount,
      pen.is_waived,
      pen.waived_amount
    FROM loan_schedules ls
    LEFT JOIN loan_payments lp
      ON lp.loan_schedule_id = ls.id
      AND lp.is_reversed = false
    LEFT JOIN profiles p
      ON p.id = lp.agent_id
    LEFT JOIN loan_penalties pen
      ON pen.schedule_id = ls.id
    WHERE ls.loan_id = ${id}
    ${statusFilter}
    ORDER BY ls.scheduled_date ASC
  `) as unknown as any[]

  return NextResponse.json(rows)
}
