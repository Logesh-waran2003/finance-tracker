import { auth } from '@/auth'
import { db } from '@/lib/db'
import { dues, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id) return null
  if ((s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const before = await db.select().from(dues).where(eq(dues.id, id)).limit(1).then(r => r[0])
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = ['amount', 'due_date', 'notes', 'status', 'invoice_number', 'reference']
  const updates: Record<string, unknown> = { updated_at: new Date() }
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  // If cancelling, zero out outstanding
  if (body.status === 'CANCELLED') {
    updates.outstanding_amount = '0'
  }

  const [updated] = await db.update(dues).set(updates).where(eq(dues.id, id)).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'UPDATE',
    entity_type: 'due',
    entity_id: id,
    before_data: JSON.stringify({ status: before.status, outstanding_amount: before.outstanding_amount }),
    after_data: JSON.stringify({ status: updated.status, outstanding_amount: updated.outstanding_amount }),
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  // Soft delete: set status = CANCELLED
  const [updated] = await db.update(dues).set({
    status: 'CANCELLED',
    outstanding_amount: '0',
    updated_at: new Date(),
  }).where(eq(dues.id, id)).returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'CANCEL',
    entity_type: 'due',
    entity_id: id,
  })

  return NextResponse.json({ success: true })
}
