import { db } from '@/lib/db'
import { loans, customers, loanSchedules } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { requireAgent, isResponse } from '@/lib/auth/authorize'

export async function GET() {
  const userOrRes = await requireAgent()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  // Fetch loans assigned to this agent
  const rows = await db.execute(sql`
    SELECT
      l.id,
      l.loan_number,
      c.full_name           AS customer_name,
      l.daily_installment,
      l.principal_outstanding,
      l.penalty_outstanding,
      l.total_outstanding,
      l.status,
      s.id                  AS today_schedule_id,
      s.status              AS today_schedule_status,
      s.installment_amount  AS today_installment_amount
    FROM loans l
    JOIN customers c ON c.id = l.customer_id
    LEFT JOIN loan_schedules s
      ON s.loan_id = l.id AND s.scheduled_date = ${today}
    WHERE l.assigned_agent_id = ${actor.id}
      AND l.deleted_at IS NULL
      AND l.status NOT IN ('CANCELLED', 'COMPLETED')
    ORDER BY s.status NULLS LAST, c.full_name
    LIMIT 200
  `)

  return NextResponse.json((rows) as any[])
}
