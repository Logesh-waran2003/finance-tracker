import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAgent, isResponse } from '@/lib/auth/authorize'
import { collectInstallment } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'
import { notifications, profiles, loans, customers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAgent()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id: loanId } = await params

  try {
    const body = await request.json()
    const { payment_mode, payment_reference, transaction_reference } = body

    if (!payment_mode)
      return NextResponse.json({ error: 'payment_mode required' }, { status: 400 })

    const payment = await collectInstallment(db, {
      loanId,
      agentId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
      isAdmin: actor.role === 'ADMIN',
      paymentMode: payment_mode,
      paymentReference: payment_reference ?? undefined,
      transactionReference: transaction_reference ?? undefined,
    })

    // Fire-and-forget: notify all active admins in the same branch
    const adminConditions = actor.branch_id
      ? and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true), eq(profiles.branch_id, actor.branch_id))
      : and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true))

    Promise.all([
      db.select({ loan_number: loans.loan_number }).from(loans).where(eq(loans.id, loanId)).limit(1),
      db.select({ full_name: customers.full_name }).from(customers).where(eq(customers.id, payment.customer_id)).limit(1),
      db.select({ id: profiles.id }).from(profiles).where(adminConditions),
    ]).then(([loanRows, custRows, admins]) => {
      if (admins.length === 0) return
      const loanNumber = loanRows[0]?.loan_number ?? loanId
      const customerName = custRows[0]?.full_name ?? 'Unknown customer'
      return db.insert(notifications).values(
        admins.map(a => ({
          recipient_id: a.id,
          type: 'GENERAL' as const,
          title: 'Loan Payment Pending Approval',
          body: `${actor.name} collected ₹${parseFloat(payment.amount as string).toLocaleString('en-IN')} from ${customerName} (${loanNumber}) — pending your approval`,
          reference_id: payment.id,
          reference_type: 'loan_payment',
        }))
      )
    }).catch(() => { /* notification failure must not break the collection */ })

    return NextResponse.json(payment, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ServiceError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[POST /api/agent/loans/[id]/collect]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
