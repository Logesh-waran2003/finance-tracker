import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { loanRequests, profiles, customers } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import type { Session } from 'next-auth'
import AdminLoanRequestsClient from '@/components/loans/admin-loan-requests-client'

export default async function AdminLoanRequestsPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const branchId = (session.user as any).branch_id as string | null

  const rows = await db
    .select({
      id: loanRequests.id,
      request_number: loanRequests.request_number,
      status: loanRequests.status,
      customer_id: loanRequests.customer_id,
      customer_name: customers.full_name,
      customer_code: customers.customer_code,
      new_customer_name: loanRequests.new_customer_name,
      new_customer_phone: loanRequests.new_customer_phone,
      new_customer_area: loanRequests.new_customer_area,
      loan_amount: loanRequests.loan_amount,
      interest_percentage: loanRequests.interest_percentage,
      daily_installment: loanRequests.daily_installment,
      penalty_amount: loanRequests.penalty_amount,
      disbursement_date: loanRequests.disbursement_date,
      notes: loanRequests.notes,
      rejection_reason: loanRequests.rejection_reason,
      requested_by: loanRequests.requested_by,
      agent_name: profiles.full_name,
      created_at: loanRequests.created_at,
      created_loan_id: loanRequests.created_loan_id,
    })
    .from(loanRequests)
    .leftJoin(customers, eq(loanRequests.customer_id, customers.id))
    .leftJoin(profiles, eq(loanRequests.requested_by, profiles.id))
    .where(branchId ? eq(loanRequests.branch_id, branchId) : undefined)
    .orderBy(desc(loanRequests.created_at))
    .limit(200)

  // Fetch agents for the approve dialog
  const agents = await db
    .select({ id: profiles.id, full_name: profiles.full_name, employee_code: profiles.employee_code })
    .from(profiles)
    .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true)))
    .orderBy(profiles.full_name)

  return <AdminLoanRequestsClient initial={rows as any} agents={agents as any} />
}
