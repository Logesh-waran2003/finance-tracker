import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAgent, isResponse } from '@/lib/auth/authorize'
import { collectInstallment } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'

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

    return NextResponse.json(payment, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ServiceError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[POST /api/agent/loans/[id]/collect]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
