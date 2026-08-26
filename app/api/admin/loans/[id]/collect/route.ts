import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, collectInstallmentSchema } from '@/lib/validation'
import { collectInstallment } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  const parsed = await parseBody(request, collectInstallmentSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const payment = await collectInstallment(db, {
      loanId: id,
      agentId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
      isAdmin: true,
      paymentMode: body.payment_mode,
      paymentReference: body.payment_reference,
      transactionReference: body.transaction_reference,
    })
    return NextResponse.json(payment)
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
