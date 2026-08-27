import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { customers, dues, profiles, branches, loans, collections } from '@/lib/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { AdminCustomerTable } from '@/components/customers/admin-customer-table'
import type { Session } from 'next-auth'

export default async function AdminCustomersPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const [custList, agents, branchList, outstanding, loanAgg, freeformAgg] = await Promise.all([
    db.select({
      id: customers.id,
      customer_code: customers.customer_code,
      full_name: customers.full_name,
      phone: customers.phone,
      area: customers.area,
      city: customers.city,
      assigned_agent_id: customers.assigned_agent_id,
      agent_name: profiles.full_name,
      branch_id: customers.branch_id,
      opening_balance: customers.opening_balance,
      is_active: customers.is_active,
      created_at: customers.created_at,
    }).from(customers).leftJoin(profiles, eq(customers.assigned_agent_id, profiles.id)),

    db.select({ id: profiles.id, full_name: profiles.full_name })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true))),

    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.is_active, true)),

    db.select({
      customer_id: dues.customer_id,
      total: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')`,
    }).from(dues)
      .where(and(
        sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`,
        isNull(dues.deleted_at)
      ))
      .groupBy(dues.customer_id),

    db.select({
      customer_id: loans.customer_id,
      total_loan_amount: sql<string>`coalesce(sum(${loans.principal_outstanding}), '0')`,
      total_loan_interest: sql<string>`coalesce(max(${loans.interest_percentage}), '0')`,
      active_loan_count: sql<string>`count(*)::text`,
    }).from(loans)
      .where(sql`${loans.status} NOT IN ('COMPLETED', 'CANCELLED', 'DRAFT')`)
      .groupBy(loans.customer_id),

    db.select({
      customer_id: collections.customer_id,
      total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    }).from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        isNull(collections.due_id),
        isNull(collections.deleted_at)
      ))
      .groupBy(collections.customer_id),
  ])

  const outMap = new Map(outstanding.map(o => [o.customer_id, o.total ?? '0']))
  const loanMap = new Map(loanAgg.map(o => [o.customer_id, o]))
  const freeformMap = new Map(freeformAgg.map(o => [o.customer_id, o.total ?? '0']))

  const data = custList.map(c => ({
    ...c,
    outstanding_total: String(
      Math.max(0,
        parseFloat(c.opening_balance as string ?? '0')
        + parseFloat(outMap.get(c.id) ?? '0')
        + parseFloat(loanMap.get(c.id)?.total_loan_amount ?? '0')
        - parseFloat(freeformMap.get(c.id) ?? '0')
      )
    ),
    total_loan_amount: loanMap.get(c.id)?.total_loan_amount ?? '0',
    total_loan_interest: loanMap.get(c.id)?.total_loan_interest ?? '0',
    active_loan_count: parseInt(loanMap.get(c.id)?.active_loan_count ?? '0'),
  }))

  return <AdminCustomerTable initial={data} agents={agents} branches={branchList} />
}
