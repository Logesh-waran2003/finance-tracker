import { db } from '@/lib/db'
import { collections } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, adminCollectionActionSchema } from '@/lib/validation'
import { writeLedgerEntry } from '@/lib/modules/ledger/service'
import { logAudit } from '@/lib/modules/audit/service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  const parsed = await parseBody(request, adminCollectionActionSchema)
  if (!parsed.ok) return parsed.response
  const { action, reason } = parsed.data

  // IDOR check: fetch with branch filter so an admin cannot action another branch's collection
  const branchCondition = actor.branch_id
    ? and(eq(collections.id, id), eq(collections.branch_id, actor.branch_id), isNull(collections.deleted_at))
    : and(eq(collections.id, id), isNull(collections.deleted_at))

  const existing = await db
    .select()
    .from(collections)
    .where(branchCondition)
    .limit(1)
    .then(r => r[0])

  if (!existing) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only PENDING collections can be actioned' }, { status: 400 })
  }

  const now = new Date()
  let updateValues: Partial<typeof collections.$inferInsert> = { updated_at: now }
  let auditAction = ''

  if (action === 'confirm') {
    updateValues = { ...updateValues, status: 'CONFIRMED', confirmed_by: actor.id, confirmed_at: now }
    auditAction = 'CONFIRM'
  } else if (action === 'reject') {
    updateValues = { ...updateValues, status: 'REJECTED', rejected_reason: reason ?? null }
    auditAction = 'REJECT'
  } else {
    // cancel
    updateValues = { ...updateValues, status: 'CANCELLED' }
    auditAction = 'CANCEL'
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(collections)
      .set(updateValues)
      .where(eq(collections.id, id))
      .returning()

    await logAudit(tx, {
      actor_id: actor.id,
      actor_name: actor.name,
      actor_email: actor.email,
      action: auditAction,
      entity_type: 'collection',
      entity_id: id,
      before_data: { status: existing.status },
      after_data: { status: row.status, ...(reason ? { rejected_reason: reason } : {}) },
      branch_id: actor.branch_id,
    })

    // Write ledger entry only when confirming a collection
    if (action === 'confirm') {
      await writeLedgerEntry(tx, {
        entity_type: 'collection',
        entity_id: id,
        entry_type: 'CREDIT',
        amount: existing.amount,
        actor_id: actor.id,
        branch_id: existing.branch_id,
        notes: `Collection ${existing.collection_number ?? id} confirmed`,
      })
    }

    return row
  })

  return NextResponse.json(updated)
}
