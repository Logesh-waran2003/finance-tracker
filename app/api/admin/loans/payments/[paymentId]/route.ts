import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { confirmLoanPayment, rejectLoanPayment } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { paymentId } = await params

  try {
    const body = await request.json()
    const { action, reason } = body

    if (action === 'confirm') {
      const payment = await confirmLoanPayment(db, {
        paymentId,
        confirmedBy: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        branchId: actor.branch_id,
      })
      return NextResponse.json(payment)
    }

    if (action === 'reject') {
      if (!reason?.trim()) {
        return NextResponse.json({ error: 'reason is required for rejection' }, { status: 400 })
      }
      await rejectLoanPayment(db, {
        paymentId,
        reason,
        rejectedBy: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        branchId: actor.branch_id,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'action must be confirm or reject' }, { status: 400 })
  } catch (err: unknown) {
    if (err instanceof ServiceError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[PATCH /api/admin/loans/payments/[paymentId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
