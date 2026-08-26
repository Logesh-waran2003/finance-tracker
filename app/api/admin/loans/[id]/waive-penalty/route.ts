import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, waivePenaltySchema } from '@/lib/validation'
import { waivePenalty } from '@/lib/modules/loans/payment-service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  await params // loan id unused — waivePenalty uses penaltyId

  const parsed = await parseBody(request, waivePenaltySchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    await waivePenalty(db, {
      penaltyId: body.penalty_id,
      waivedAmount: body.waived_amount,
      reason: body.reason,
      waivedBy: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
