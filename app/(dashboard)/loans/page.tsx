import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { AgentLoansClient, type AgentLoan } from '@/components/loans/agent-loans-client'

export default async function AgentLoansPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const { role, name } = session.user
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') redirect('/dashboard')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  /**
   * `today_payment_status` matters as much as the schedule status: a loan
   * payment stays PENDING until an admin approves it. Without it the screen
   * showed a collected installment as still collectable, which is how an agent
   * ends up taking the same money twice. This mirrors GET /api/agent/loans.
   */
  const loanRows = await db.execute(sql`
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
      s.installment_amount  AS today_installment_amount,
      p.status              AS today_payment_status
    FROM loans l
    JOIN customers c ON c.id = l.customer_id
    LEFT JOIN loan_schedules s
      ON s.loan_id = l.id AND s.scheduled_date = ${today}
    LEFT JOIN loan_payments p
      ON p.loan_schedule_id = s.id
      AND p.is_reversed = false
      AND p.status IN ('PENDING', 'CONFIRMED')
    WHERE l.deleted_at IS NULL
      AND l.status NOT IN ('CANCELLED', 'COMPLETED')
    ORDER BY s.status NULLS LAST, c.full_name
    LIMIT 200
  `)

  const loans = loanRows as unknown as AgentLoan[]

  return <AgentLoansClient loans={loans} agentName={name ?? ''} />
}
