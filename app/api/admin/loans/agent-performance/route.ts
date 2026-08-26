import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? todayIST()

  const rows = await db.execute(sql`
    SELECT
      p.id                                               AS agent_id,
      p.full_name                                        AS agent_name,
      COUNT(DISTINCT l.id)                               AS assigned_count,
      COALESCE(SUM(ls.installment_amount), 0)            AS expected_amount,
      COALESCE(SUM(
        CASE WHEN ls.status = 'PAID'
        THEN lp.amount ELSE 0 END
      ), 0)                                              AS collected_amount,
      COALESCE(SUM(
        CASE WHEN ls.status = 'MISSED'
        THEN ls.installment_amount ELSE 0 END
      ), 0)                                              AS missed_amount,
      CASE
        WHEN COALESCE(SUM(ls.installment_amount), 0) = 0 THEN 0
        ELSE ROUND(
          COALESCE(SUM(
            CASE WHEN ls.status = 'PAID' THEN lp.amount ELSE 0 END
          ), 0)
          / SUM(ls.installment_amount) * 100, 2
        )
      END                                                AS collection_rate
    FROM profiles p
    JOIN loans l ON l.assigned_agent_id = p.id AND l.deleted_at IS NULL
    LEFT JOIN loan_schedules ls
      ON ls.loan_id = l.id AND ls.scheduled_date = ${date}
    LEFT JOIN loan_payments lp
      ON lp.loan_schedule_id = ls.id AND lp.is_reversed = false
    WHERE p.role = 'COLLECTION_AGENT'
      AND p.is_active = true
    GROUP BY p.id, p.full_name
    ORDER BY collection_rate DESC
  `) as unknown as any[]

  return NextResponse.json(rows)
}
