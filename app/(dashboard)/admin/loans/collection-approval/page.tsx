import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { loanPayments, loans, customers, profiles } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { Session } from 'next-auth'
import AdminCollectionApprovalClient, {
  type PendingLoanPayment,
} from '@/components/loans/admin-collection-approval-client'

export default async function CollectionApprovalPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/dashboard')

  const branchId = session.user.branch_id

  const baseWhere = [
    eq(loanPayments.status, 'PENDING'),
    eq(loanPayments.is_reversed, false),
  ]

  if (branchId) {
    baseWhere.push(eq(loans.branch_id, branchId))
  }

  const rows = await db
    .select({
      id: loanPayments.id,
      payment_number: loanPayments.payment_number,
      amount: loanPayments.amount,
      payment_mode: loanPayments.payment_mode,
      scheduled_date: loanPayments.scheduled_date,
      collected_at: loanPayments.updated_at,
      loan_number: loans.loan_number,
      customer_name: customers.full_name,
      agent_name: profiles.full_name,
    })
    .from(loanPayments)
    .innerJoin(loans, eq(loans.id, loanPayments.loan_id))
    .innerJoin(customers, eq(customers.id, loanPayments.customer_id))
    .innerJoin(profiles, eq(profiles.id, loanPayments.agent_id))
    .where(and(...baseWhere))
    .orderBy(desc(loanPayments.created_at))
    .limit(200)

  return (
    <AdminCollectionApprovalClient initial={rows as unknown as PendingLoanPayment[]} />
  )
}

