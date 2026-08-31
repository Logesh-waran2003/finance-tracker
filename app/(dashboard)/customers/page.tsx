import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { loanRequests, customers, dues, loans, collections } from '@/lib/db/schema'
import { eq, and, sql, isNull, inArray } from 'drizzle-orm'
import type { Session } from 'next-auth'
import AgentCustomersClient from '@/components/customers/agent-customers-client'

export default async function AgentCustomersPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const role = session.user.role
  if (role !== 'COLLECTION_AGENT') redirect('/dashboard')

  const agentId = session.user.id

  // All loan requests submitted by this agent
  const requestRows = await db
    .select({
      request_id: loanRequests.id,
      request_number: loanRequests.request_number,
      status: loanRequests.status,
      customer_id: loanRequests.customer_id,
      customer_name: customers.full_name,
      customer_code: customers.customer_code,
      new_customer_name: loanRequests.new_customer_name,
      new_customer_phone: loanRequests.new_customer_phone,
      new_customer_area: loanRequests.new_customer_area,
      loan_amount: loanRequests.loan_amount,
      disbursement_date: loanRequests.disbursement_date,
      created_at: loanRequests.created_at,
    })
    .from(loanRequests)
    .leftJoin(customers, eq(loanRequests.customer_id, customers.id))
    .where(eq(loanRequests.requested_by, agentId))
    .orderBy(sql`${loanRequests.created_at} DESC`)
    .limit(200)

  // For existing customers, compute outstanding
  const existingIds = requestRows
    .map(r => r.customer_id)
    .filter((id): id is string => id !== null)

  const outstandingMap = new Map<string, string>()

  if (existingIds.length > 0) {
    const [duesAgg, loanAgg, freeformAgg, custBal] = await Promise.all([
      db.select({
        customer_id: dues.customer_id,
        total: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')`,
      }).from(dues)
        .where(and(
          inArray(dues.customer_id, existingIds),
          sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`,
          isNull(dues.deleted_at),
        ))
        .groupBy(dues.customer_id),

      db.select({
        customer_id: loans.customer_id,
        total: sql<string>`coalesce(sum(${loans.total_outstanding}), '0')`,
      }).from(loans)
        .where(and(
          inArray(loans.customer_id, existingIds),
          sql`${loans.status} NOT IN ('COMPLETED', 'CANCELLED', 'DRAFT')`,
        ))
        .groupBy(loans.customer_id),

      db.select({
        customer_id: collections.customer_id,
        total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
      }).from(collections)
        .where(and(
          inArray(collections.customer_id, existingIds),
          eq(collections.status, 'CONFIRMED'),
          isNull(collections.due_id),
          isNull(collections.deleted_at),
        ))
        .groupBy(collections.customer_id),

      db.select({
        id: customers.id,
        opening_balance: customers.opening_balance,
      }).from(customers)
        .where(inArray(customers.id, existingIds)),
    ])

    const duesMap = new Map(duesAgg.map(o => [o.customer_id, parseFloat(o.total)]))
    const loanMap = new Map(loanAgg.map(o => [o.customer_id, parseFloat(o.total)]))
    const freeformMap = new Map(freeformAgg.map(o => [o.customer_id, parseFloat(o.total)]))
    const balMap = new Map(custBal.map(c => [c.id, parseFloat(c.opening_balance as string ?? '0')]))

    for (const id of existingIds) {
      const total = Math.max(0,
        (balMap.get(id) ?? 0)
        + (duesMap.get(id) ?? 0)
        + (loanMap.get(id) ?? 0)
        - (freeformMap.get(id) ?? 0)
      )
      outstandingMap.set(id, total.toFixed(2))
    }
  }

  const data = requestRows.map(r => ({
    ...r,
    created_at: r.created_at?.toISOString() ?? null,
    outstanding_total: r.customer_id ? (outstandingMap.get(r.customer_id) ?? null) : null,
  }))

  return <AgentCustomersClient initial={data} />
}
