import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { AgentLoansClient } from '@/components/loans/agent-loans-client'

export default async function AgentLoansPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const user = session.user as any
  if (!['COLLECTION_AGENT', 'ADMIN'].includes(user.role)) redirect('/dashboard')

  const agentId = session.user.id as string
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

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
      s.installment_amount  AS today_installment_amount
    FROM loans l
    JOIN customers c ON c.id = l.customer_id
    LEFT JOIN loan_schedules s
      ON s.loan_id = l.id AND s.scheduled_date = ${today}
    WHERE l.deleted_at IS NULL
      AND l.status NOT IN ('CANCELLED', 'COMPLETED')
    ORDER BY s.status NULLS LAST, c.full_name
    LIMIT 200
  `)

  const loans = (loanRows) as any[]

  return (
    <AgentLoansClient
      loans={loans}
      agentName={user.name ?? ''}
    />
  )
}
