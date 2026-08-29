import { db } from '@/lib/db'
import { customers, dues, collections, loans } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  const customer = await db
    .select()
    .from(customers)
    .where(
      actor.branch_id
        ? and(eq(customers.id, id), eq(customers.branch_id, actor.branch_id))
        : eq(customers.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [duesList, recentCollections, activeLoans, confirmedFreeform] = await Promise.all([
    // Unpaid dues
    db.select({
      id: dues.id,
      invoice_number: dues.invoice_number,
      amount: dues.amount,
      outstanding_amount: dues.outstanding_amount,
      due_date: dues.due_date,
      status: dues.status,
    })
      .from(dues)
      .where(and(
        eq(dues.customer_id, id),
        isNull(dues.deleted_at),
        sql`${dues.status} NOT IN ('PAID','CANCELLED')`,
      ))
      .limit(10),

    // Last 5 confirmed collections
    db.select({
      id: collections.id,
      amount: collections.amount,
      payment_mode: collections.payment_mode,
      collected_at: collections.collected_at,
      status: collections.status,
    })
      .from(collections)
      .where(and(
        eq(collections.customer_id, id),
        eq(collections.status, 'CONFIRMED'),
        isNull(collections.deleted_at),
      ))
      .orderBy(sql`${collections.collected_at} DESC`)
      .limit(5),

    // Active loans
    db.select({
      id: loans.id,
      loan_number: loans.loan_number,
      loan_amount: loans.loan_amount,
      total_outstanding: loans.total_outstanding,
      status: loans.status,
      disbursement_date: loans.disbursement_date,
    })
      .from(loans)
      .where(and(
        eq(loans.customer_id, id),
        sql`${loans.status} NOT IN ('COMPLETED','CANCELLED','DRAFT')`,
      ))
      .limit(10),

    // Confirmed freeform collections sum
    db.select({ total: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(
        eq(collections.customer_id, id),
        eq(collections.status, 'CONFIRMED'),
        isNull(collections.due_id),
        isNull(collections.deleted_at),
      ))
      .then(r => parseFloat(r[0]?.total ?? '0')),
  ])

  const duesOutstanding = duesList.reduce(
    (s, d) => s + parseFloat(d.outstanding_amount as string), 0
  )
  const loanOutstanding = activeLoans.reduce(
    (s, l) => s + parseFloat(l.total_outstanding as string), 0
  )
  const totalOutstanding = Math.max(
    0,
    parseFloat(customer.opening_balance as string ?? '0')
    + duesOutstanding
    + loanOutstanding
    - confirmedFreeform
  )

  return NextResponse.json({
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      customer_code: customer.customer_code,
      phone: customer.phone,
      area: customer.area,
      city: customer.city,
      opening_balance: customer.opening_balance,
      is_active: customer.is_active,
    },
    summary: {
      total_outstanding: totalOutstanding.toFixed(2),
      dues_outstanding: duesOutstanding.toFixed(2),
      loan_outstanding: loanOutstanding.toFixed(2),
      active_loan_count: activeLoans.length,
    },
    dues: duesList,
    active_loans: activeLoans,
    recent_collections: recentCollections,
  })
}
