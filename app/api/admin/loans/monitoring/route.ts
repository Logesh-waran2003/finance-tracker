import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { sql } from 'drizzle-orm'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const date = url.searchParams.get('date') ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const agentId = url.searchParams.get('agent_id')

  const agentFilter = agentId ? sql`AND l.assigned_agent_id = ${agentId}` : sql``
  const branchFilter = actor.branch_id ? sql`AND l.branch_id = ${actor.branch_id}` : sql``

  const rows = await db.execute(sql`
    SELECT
      c.full_name        AS customer_name,
      pr.full_name       AS agent_name,
      l.loan_number,
      s.installment_amount AS daily_due,
      pay.amount         AS paid,
      pen.penalty_amount AS penalty,
      s.status           AS schedule_status,
      l.principal_outstanding
    FROM loan_schedules s
    JOIN loans l    ON l.id = s.loan_id
    JOIN customers c ON c.id = l.customer_id
    JOIN profiles pr ON pr.id = l.assigned_agent_id
    LEFT JOIN loan_payments pay
      ON pay.loan_schedule_id = s.id AND pay.is_reversed = false
    LEFT JOIN loan_penalties pen
      ON pen.schedule_id = s.id
    WHERE s.scheduled_date = ${date}
      AND l.deleted_at IS NULL
      ${agentFilter}
      ${branchFilter}
    ORDER BY s.status, c.full_name
    LIMIT 500
  `)

  const data = (rows) as any[]

  // Build summary
  const expected = data.reduce((s: number, r: any) => s + parseFloat(r.daily_due ?? 0), 0)
  const collected = data.filter((r: any) => r.schedule_status === 'PAID')
    .reduce((s: number, r: any) => s + parseFloat(r.paid ?? r.daily_due ?? 0), 0)
  const pending = data.filter((r: any) => r.schedule_status === 'PENDING').length
  const missed = data.filter((r: any) => r.schedule_status === 'MISSED').length

  return NextResponse.json({ rows: data, summary: { expected, collected, pending, missed } })
}
