import { db } from '@/lib/db'
import { collections, dues, customers } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull, sql } from 'drizzle-orm'
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

      // Update the linked due's outstanding_amount if present
      if (existing.due_id) {
        const due = await tx
          .select()
          .from(dues)
          .where(eq(dues.id, existing.due_id))
          .limit(1)
          .then(r => r[0])

        if (due) {
          const outstandingCents = Math.round(parseFloat(due.outstanding_amount as string) * 100)
          const collectionCents = Math.round(parseFloat(existing.amount as string) * 100)
          const newOutstandingCents = outstandingCents - collectionCents

          const newOutstanding = newOutstandingCents <= 0 ? '0.00' : (newOutstandingCents / 100).toFixed(2)
          const newStatus = newOutstandingCents <= 0 ? 'PAID' : 'PARTIALLY_PAID'

          await tx
            .update(dues)
            .set({
              outstanding_amount: newOutstanding,
              status: newStatus,
              updated_at: now,
            })
            .where(eq(dues.id, existing.due_id))

          await logAudit(tx, {
            actor_id: actor.id,
            actor_name: actor.name,
            actor_email: actor.email,
            action: 'UPDATE',
            entity_type: 'due',
            entity_id: existing.due_id,
            before_data: { outstanding_amount: due.outstanding_amount, status: due.status },
            after_data: { outstanding_amount: newOutstanding, status: newStatus },
            branch_id: actor.branch_id,
          })
        }
      } else {
        // Freeform collection (no due linked) — reduce customer opening_balance
        const customer = await tx
          .select({ opening_balance: customers.opening_balance })
          .from(customers)
          .where(eq(customers.id, existing.customer_id))
          .limit(1)
          .then(r => r[0])

        if (customer) {
          const balanceCents = Math.round(parseFloat(customer.opening_balance as string) * 100)
          const collectionCents = Math.round(parseFloat(existing.amount as string) * 100)
          const newBalanceCents = Math.max(0, balanceCents - collectionCents)
          const newBalance = (newBalanceCents / 100).toFixed(2)

          await tx
            .update(customers)
            .set({ opening_balance: newBalance, updated_at: now })
            .where(eq(customers.id, existing.customer_id))
        }
      }
    }

    return row
  })

  return NextResponse.json(updated)
}
