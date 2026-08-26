import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { AdminLoanMonitoringClient } from '@/components/loans/admin-loan-monitoring-client'

export default async function AdminLoanMonitoringPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  const [scheduleRows, agents] = await Promise.all([
    db.execute(sql`
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
      JOIN loans l     ON l.id = s.loan_id
      JOIN customers c  ON c.id = l.customer_id
      JOIN profiles pr  ON pr.id = l.assigned_agent_id
      LEFT JOIN loan_payments pay
        ON pay.loan_schedule_id = s.id AND pay.is_reversed = false
      LEFT JOIN loan_penalties pen
        ON pen.schedule_id = s.id
      WHERE s.scheduled_date = ${today}
        AND l.deleted_at IS NULL
      ORDER BY s.status, c.full_name
      LIMIT 500
    `),

    db
      .select({ id: profiles.id, full_name: profiles.full_name })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true)))
      .orderBy(profiles.full_name),
  ])

  const rows = (scheduleRows) as any[]

  const expected = rows.reduce((s: number, r: any) => s + parseFloat(r.daily_due ?? 0), 0)
  const collected = rows
    .filter((r: any) => r.schedule_status === 'PAID')
    .reduce((s: number, r: any) => s + parseFloat(r.paid ?? r.daily_due ?? 0), 0)
  const pending = rows.filter((r: any) => r.schedule_status === 'PENDING').length
  const missed = rows.filter((r: any) => r.schedule_status === 'MISSED').length

  return (
    <AdminLoanMonitoringClient
      initialRows={rows}
      initialDate={today}
      agents={agents as any}
      summary={{ expected, collected, pending, missed }}
    />
  )
}
