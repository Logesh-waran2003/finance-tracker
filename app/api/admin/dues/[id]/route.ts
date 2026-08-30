import { db } from '@/lib/db'
import { dues, customers, auditLogs, collections } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { withErrorHandler, requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, updateDueSchema } from '@/lib/validation'

// Valid forward-only state transitions for dues
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PAID: [],       // terminal — only a reversal flow can change this
  CANCELLED: [],  // terminal
}

export const PATCH = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params
  const _parsed = await parseBody(request, updateDueSchema)
  if (!_parsed.ok) return _parsed.response
  const data = _parsed.data

  // IDOR: join through customer to enforce branch isolation
  const before = await db
    .select({ due: dues, customer_branch: customers.branch_id })
    .from(dues)
    .leftJoin(customers, eq(dues.customer_id, customers.id))
    .where(and(eq(dues.id, id), isNull(dues.deleted_at)))
    .limit(1)
    .then(r => r[0])

  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (actor.branch_id && before.customer_branch !== actor.branch_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // State transition guard
  if (data.status !== undefined && data.status !== before.due.status) {
    const allowed = ALLOWED_TRANSITIONS[before.due.status] ?? []
    if (!allowed.includes(data.status)) {
      return NextResponse.json(
        { error: `Invalid transition: ${before.due.status} → ${data.status}` },
        { status: 400 }
      )
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date() }
  if (data.invoice_number !== undefined) updates.invoice_number = data.invoice_number
  if (data.reference !== undefined) updates.reference = data.reference
  if (data.due_date !== undefined) updates.due_date = data.due_date
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.penalty_rate !== undefined) updates.penalty_rate = String(data.penalty_rate)
  if (data.status !== undefined) {
    updates.status = data.status
    if (data.status === 'CANCELLED') updates.outstanding_amount = '0'
  }

  const updated = await db.transaction(async (tx) => {
    if (data.amount !== undefined) {
      updates.amount = String(data.amount)

      // Recompute outstanding_amount = max(new_amount - confirmed_paid, 0)
      const [paid] = await tx.select({
        total: sql<string>`coalesce(sum(${collections.amount}), '0')`
      }).from(collections)
        .where(and(
          eq(collections.due_id, id),
          eq(collections.status, 'CONFIRMED'),
          isNull(collections.deleted_at)
        ))
      const paidCents = Math.round(parseFloat(paid?.total ?? '0') * 100)
      const newAmountCents = Math.round(data.amount * 100)
      updates.outstanding_amount = String(Math.max(0, newAmountCents - paidCents) / 100)
    }

    const [upd] = await tx.update(dues).set(updates).where(eq(dues.id, id)).returning()

    await tx.insert(auditLogs).values({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_email: actor.email,
      action: 'UPDATE',
      entity_type: 'due',
      entity_id: id,
      before_data: { status: before.due.status, outstanding_amount: before.due.outstanding_amount },
      after_data: { status: upd.status, outstanding_amount: upd.outstanding_amount },
      branch_id: actor.branch_id,
    })

    return upd
  })

  return NextResponse.json(updated)
})

export const DELETE = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: join through customer to enforce branch isolation
  const before = await db
    .select({ due: dues, customer_branch: customers.branch_id })
    .from(dues)
    .leftJoin(customers, eq(dues.customer_id, customers.id))
    .where(and(eq(dues.id, id), isNull(dues.deleted_at)))
    .limit(1)
    .then(r => r[0])

  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (actor.branch_id && before.customer_branch !== actor.branch_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (before.due.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Due is already cancelled' }, { status: 400 })
  }
  if (before.due.status === 'PAID') {
    return NextResponse.json({ error: 'Cannot cancel a fully paid due' }, { status: 400 })
  }

  const [updated] = await db.update(dues).set({
    status: 'CANCELLED',
    outstanding_amount: '0',
    updated_at: new Date(),
  }).where(eq(dues.id, id)).returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'CANCEL',
    entity_type: 'due',
    entity_id: id,
    before_data: { status: before.due.status },
    after_data: { status: 'CANCELLED' },
    branch_id: actor.branch_id,
  })

  return NextResponse.json({ success: true })
})
