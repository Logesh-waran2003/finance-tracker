import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { waivePenalty } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(
  request: Request,
  { params: _params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  try {
    const { penalty_id, waived_amount, reason } = await request.json()
    if (!penalty_id) return NextResponse.json({ error: 'penalty_id required' }, { status: 400 })
    if (!waived_amount) return NextResponse.json({ error: 'waived_amount required' }, { status: 400 })
    if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 })

    await waivePenalty(db, {
      penaltyId: penalty_id,
      waivedAmount: parseFloat(waived_amount),
      reason,
      waivedBy: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof ServiceError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[POST /api/admin/loans/[id]/waive]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
