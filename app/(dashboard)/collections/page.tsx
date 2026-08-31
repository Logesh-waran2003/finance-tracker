import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { collections, customers, dues, loans } from '@/lib/db/schema'
import { eq, and, desc, sql, isNull, ne } from 'drizzle-orm'
import { CollectionForm } from '@/components/collections/collection-form'
import type { Session } from 'next-auth'

export default async function CollectionsPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') redirect('/dashboard')

  const userId = session.user.id

  // Customer IDs locked by another agent's PENDING collection within last 150 minutes
  const lockSince = new Date(Date.now() - 150 * 60 * 1000).toISOString()
  const lockedRows = await db
    .select({ customer_id: collections.customer_id })
    .from(collections)
    .where(and(
      eq(collections.status, 'PENDING'),
      ne(collections.agent_id, userId),
      sql`${collections.created_at} >= ${lockSince}::timestamptz`,
      isNull(collections.deleted_at),
    ))
  const lockedCustomerIds = new Set(lockedRows.map(r => r.customer_id))

  const [assignedCustomers, initialCollections, loanPaymentRows, outstanding, loanOutstanding] = await Promise.all([
    db.select({
      id: customers.id,
      customer_code: customers.customer_code,
      full_name: customers.full_name,
      opening_balance: customers.opening_balance,
    }).from(customers)
      .where(and(eq(customers.assigned_agent_id, userId), eq(customers.is_active, true))),

    db.select({
      id: collections.id,
      collection_number: collections.collection_number,
      customer_id: collections.customer_id,
      customer_name: customers.full_name,
      amount: collections.amount,
      payment_mode: collections.payment_mode,
      status: collections.status,
      collected_at: collections.collected_at,
      notes: collections.notes,
      rejected_reason: collections.rejected_reason,
    }).from(collections)
      .leftJoin(customers, eq(collections.customer_id, customers.id))
      .where(eq(collections.agent_id, userId))
      .orderBy(desc(collections.collected_at))
      .limit(50),

    // Loan installment payments by this agent
    db.execute(sql`
      SELECT
        lp.id,
        lp.payment_number   AS collection_number,
        c.full_name         AS customer_name,
        lp.customer_id,
        lp.amount,
        lp.payment_mode,
        lp.status           AS status,
        lp.created_at       AS collected_at,
        l.loan_number       AS notes,
        lp.rejected_reason  AS rejected_reason,
        'loan'              AS source
      FROM loan_payments lp
      JOIN loans l ON l.id = lp.loan_id
      JOIN customers c ON c.id = lp.customer_id
      WHERE lp.agent_id = ${userId}
        AND lp.is_reversed = false
      ORDER BY lp.created_at DESC
      LIMIT 100
    `),

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
      total: sql<string>`coalesce(sum(${loans.total_outstanding}), '0')`,
    }).from(loans)
      .where(sql`${loans.status} NOT IN ('COMPLETED', 'CANCELLED', 'DRAFT')`)
      .groupBy(loans.customer_id),
  ])

  const outMap = new Map(outstanding.map(o => [o.customer_id, o.total ?? '0']))
  const loanMap = new Map(loanOutstanding.map(o => [o.customer_id, o.total ?? '0']))

  const mergedCollections = [
    ...initialCollections.map(r => ({
      ...r,
      collection_number: r.collection_number ?? null,
      collected_at: r.collected_at?.toISOString() ?? null,
      source: 'freeform' as const,
    })),
    ...(loanPaymentRows as any[]).map(r => ({
      ...r,
      collected_at: r.collected_at ? new Date(r.collected_at).toISOString() : null,
      source: 'loan' as const,
    })),
  ].sort((a, b) => {
    if (!a.collected_at) return 1
    if (!b.collected_at) return -1
    return new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime()
  })

  // Filter out locked customers from the collection form dropdown
  const availableCustomers = assignedCustomers.filter(c => !lockedCustomerIds.has(c.id))

  return (
    <CollectionForm
      customers={availableCustomers.map(c => ({
        ...c,
        outstanding_total: String(
          Math.max(0,
            parseFloat(outMap.get(c.id) ?? '0')
            + parseFloat(c.opening_balance as string ?? '0')
            + parseFloat(loanMap.get(c.id) ?? '0')
          )
        ),
      }))}
      initial={mergedCollections}
    />
  )
}
