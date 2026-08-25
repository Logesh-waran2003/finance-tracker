import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, adminReconciliationActionSchema } from '@/lib/validation'
import { verifyReconciliation } from '@/lib/modules/reconciliation/service'
import { ServiceError } from '@/lib/modules/errors'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  const parsed = await parseBody(request, adminReconciliationActionSchema)
  if (!parsed.ok) return parsed.response
  const { action, reason } = parsed.data

  try {
    const updated = await verifyReconciliation(db, {
      reconciliationId: id,
      adminId: actor.id,
      adminBranchId: actor.branch_id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: action === 'verify' ? 'VERIFIED' : 'REJECTED',
      notes: reason,
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
