import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { loanSchedules, loanPayments, loanPenalties, profiles } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { getLoanWithDetails } from '@/lib/modules/loans/service'
import { AdminLoanDetailClient } from '@/components/loans/admin-loan-detail-client'
import { notFound } from 'next/navigation'

export default async function AdminLoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const { id } = await params

  const loan = await getLoanWithDetails(db, id)
  if (!loan) notFound()

  const [schedulesRaw, payments, penalties, agents] = await Promise.all([
    db.execute(
      sql`SELECT
            s.id, s.scheduled_date, s.installment_amount, s.status, s.paid_at,
            p.amount AS paid_amount, pr.full_name AS agent_name
          FROM loan_schedules s
          LEFT JOIN loan_payments p ON p.loan_schedule_id = s.id AND p.is_reversed = false
          LEFT JOIN profiles pr ON pr.id = p.agent_id
          WHERE s.loan_id = ${id}
          ORDER BY s.scheduled_date ASC
          LIMIT 365`,
    ),

    db
      .select({
        id: loanPayments.id,
        payment_number: loanPayments.payment_number,
        scheduled_date: loanPayments.scheduled_date,
        payment_date: loanPayments.payment_date,
        amount: loanPayments.amount,
        payment_mode: loanPayments.payment_mode,
        status: loanPayments.status,
        rejected_reason: loanPayments.rejected_reason,
        is_reversed: loanPayments.is_reversed,
        reversed_at: loanPayments.reversed_at,
        agent_name: profiles.full_name,
      })
      .from(loanPayments)
      .leftJoin(profiles, eq(loanPayments.agent_id, profiles.id))
      .where(eq(loanPayments.loan_id, id))
      .orderBy(desc(loanPayments.created_at)),

    db
      .select({
        id: loanPenalties.id,
        scheduled_date: loanSchedules.scheduled_date,
        penalty_amount: loanPenalties.penalty_amount,
        is_waived: loanPenalties.is_waived,
        waived_amount: loanPenalties.waived_amount,
        waiver_reason: loanPenalties.waiver_reason,
      })
      .from(loanPenalties)
      .leftJoin(loanSchedules, eq(loanPenalties.schedule_id, loanSchedules.id))
      .where(eq(loanPenalties.loan_id, id))
      .orderBy(desc(loanPenalties.created_at)),

    db
      .select({ id: profiles.id, full_name: profiles.full_name, employee_code: profiles.employee_code })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true)))
      .orderBy(profiles.full_name),
  ])

  const schedules = (schedulesRaw) as any[]

  return (
    <AdminLoanDetailClient
      loan={loan as any}
      schedules={schedules}
      payments={payments.map(p => ({
        ...p,
        reversed_at: (p.reversed_at as Date | null)?.toISOString() ?? null,
      })) as any}
      penalties={penalties as any}
      agents={agents as any}
    />
  )
}
