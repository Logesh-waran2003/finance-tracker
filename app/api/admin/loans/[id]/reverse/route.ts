import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { reversePayment } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id: _loanId } = await params

  try {
    const { payment_id, reason } = await request.json()
    if (!payment_id) return NextResponse.json({ error: 'payment_id required' }, { status: 400 })
    if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 })

    await reversePayment(db, {
      loanPaymentId: payment_id,
      reason,
      reversedBy: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof ServiceError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[POST /api/admin/loans/[id]/reverse]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
