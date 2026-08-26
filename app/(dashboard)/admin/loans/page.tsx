import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { loans, customers, profiles } from '@/lib/db/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { AdminLoansClient } from '@/components/loans/admin-loans-client'

export default async function AdminLoansPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const [loanRows, customerList, agentList] = await Promise.all([
    db
      .select({
        id: loans.id,
        loan_number: loans.loan_number,
        customer_name: customers.full_name,
        assigned_agent_name: profiles.full_name,
        loan_amount: loans.loan_amount,
        disbursed_amount: loans.disbursed_amount,
        daily_installment: loans.daily_installment,
        principal_outstanding: loans.principal_outstanding,
        penalty_outstanding: loans.penalty_outstanding,
        total_outstanding: loans.total_outstanding,
        status: loans.status,
        disbursement_date: loans.disbursement_date,
      })
      .from(loans)
      .leftJoin(customers, eq(loans.customer_id, customers.id))
      .leftJoin(profiles, eq(loans.assigned_agent_id, profiles.id))
      .where(isNull(loans.deleted_at))
      .orderBy(desc(loans.created_at))
      .limit(200),

    db
      .select({ id: customers.id, full_name: customers.full_name, customer_code: customers.customer_code })
      .from(customers)
      .where(eq(customers.is_active, true))
      .orderBy(customers.full_name),

    db
      .select({ id: profiles.id, full_name: profiles.full_name, employee_code: profiles.employee_code })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true)))
      .orderBy(profiles.full_name),
  ])

  return (
    <AdminLoansClient
      loans={loanRows as any}
      customers={customerList as any}
      agents={agentList as any}
    />
  )
}
