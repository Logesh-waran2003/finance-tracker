import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues, collections, profiles, loanRequests, loans } from '@/lib/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { CustomerDetailClient } from '@/components/customers/customer-detail-client'
import { toNumber } from '@/lib/format'

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params
  const role = session.user.role

  const customer = await db.select().from(customers).where(eq(customers.id, id)).limit(1).then(r => r[0])
  if (!customer) redirect('/customers')

  // RBAC — agent can view any customer they've collected from OR requested a loan for
  if (role === 'COLLECTION_AGENT') {
    const [hasCollection, hasLoanRequest] = await Promise.all([
      db
        .select({ id: collections.id })
        .from(collections)
        .where(and(
          eq(collections.customer_id, id),
          eq(collections.agent_id, session.user.id),
          isNull(collections.deleted_at),
        ))
        .limit(1)
        .then(r => r.length > 0),
      db
        .select({ id: loanRequests.id })
        .from(loanRequests)
        .where(and(
          eq(loanRequests.customer_id, id),
          eq(loanRequests.requested_by, session.user.id),
        ))
        .limit(1)
        .then(r => r.length > 0),
    ])
    if (!hasCollection && !hasLoanRequest) redirect('/customers')
  }

  const agent = customer.assigned_agent_id
    ? await db.select({ full_name: profiles.full_name }).from(profiles).where(eq(profiles.id, customer.assigned_agent_id)).limit(1).then(r => r[0])
    : null

  const [duesList, collectionsList, loansList] = await Promise.all([
    db.select().from(dues).where(eq(dues.customer_id, id)).orderBy(dues.created_at),
    db.select().from(collections).where(eq(collections.customer_id, id)).orderBy(collections.collected_at),
    db.select({
      id: loans.id,
      loan_number: loans.loan_number,
      loan_amount: loans.loan_amount,
      total_outstanding: loans.total_outstanding,
      principal_outstanding: loans.principal_outstanding,
      daily_installment: loans.daily_installment,
      status: loans.status,
      disbursement_date: loans.disbursement_date,
    }).from(loans)
      .where(and(eq(loans.customer_id, id), isNull(loans.deleted_at)))
      .orderBy(sql`${loans.created_at} DESC`),
  ])

  // `toNumber` is used for summing only. Every displayed amount stays a string.
  const confirmedFreeform = collectionsList
    .filter(c => c.status === 'CONFIRMED' && !c.due_id && !c.deleted_at)
    .reduce((sum, c) => sum + toNumber(c.amount), 0)

  const collectedTotal = collectionsList
    .filter(c => c.status === 'CONFIRMED' && !c.deleted_at)
    .reduce((sum, c) => sum + toNumber(c.amount), 0)

  const loanOutstanding = loansList
    .filter(l => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(l.status))
    .reduce((sum, l) => sum + toNumber(l.total_outstanding), 0)

  const duesOutstanding = duesList
    .filter(d => d.status !== 'PAID' && d.status !== 'CANCELLED')
    .reduce((sum, d) => sum + toNumber(d.outstanding_amount), 0)

  const totalOutstanding = Math.max(
    0,
    toNumber(customer.opening_balance) + duesOutstanding + loanOutstanding - confirmedFreeform
  )

  const activeLoanCount = loansList.filter(
    l => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(l.status)
  ).length

  return (
    <CustomerDetailClient
      customer={{
        id: customer.id,
        full_name: customer.full_name,
        customer_code: customer.customer_code,
        phone: customer.phone,
        email: customer.email,
        area: customer.area,
        city: customer.city,
        address: customer.address,
        notes: customer.notes,
        is_active: customer.is_active ?? false,
        gps_lat: customer.gps_lat,
        gps_lng: customer.gps_lng,
      }}
      agentName={agent?.full_name ?? null}
      totalOutstanding={totalOutstanding.toFixed(2)}
      duesOutstanding={duesOutstanding.toFixed(2)}
      collectedTotal={collectedTotal.toFixed(2)}
      activeLoanCount={activeLoanCount}
      dues={duesList.map(d => ({
        id: d.id,
        invoice_number: d.invoice_number,
        amount: d.amount,
        outstanding_amount: d.outstanding_amount,
        due_date: d.due_date,
        penalty_rate: d.penalty_rate,
        status: d.status,
        notes: d.notes,
      }))}
      collections={collectionsList.map(c => ({
        id: c.id,
        collection_number: c.collection_number,
        amount: c.amount,
        payment_mode: c.payment_mode,
        status: c.status,
        collected_at: c.collected_at?.toISOString() ?? null,
      }))}
      loans={loansList.map(l => ({
        id: l.id,
        loan_number: l.loan_number,
        loan_amount: l.loan_amount,
        total_outstanding: l.total_outstanding,
        daily_installment: l.daily_installment,
        status: l.status,
        disbursement_date: l.disbursement_date,
      }))}
      isAdmin={role === 'ADMIN'}
    />
  )
}
