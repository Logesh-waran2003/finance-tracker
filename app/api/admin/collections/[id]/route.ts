import { auth } from '@/auth'
import { db } from '@/lib/db'
import { collections, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id) return null
  if ((s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { action, reason } = body

  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1)
    .then(r => r[0])

  if (!existing) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const now = new Date()
  let updateValues: Partial<typeof collections.$inferInsert> = { updated_at: now }
  let auditAction = ''

  if (action === 'confirm') {
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING collections can be confirmed' }, { status: 400 })
    }
    updateValues = { ...updateValues, status: 'CONFIRMED', confirmed_by: actor.id as string, confirmed_at: now }
    auditAction = 'CONFIRM'
  } else if (action === 'reject') {
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING collections can be rejected' }, { status: 400 })
    }
    if (!reason) return NextResponse.json({ error: 'reason is required for rejection' }, { status: 400 })
    updateValues = { ...updateValues, status: 'REJECTED', rejected_reason: reason }
    auditAction = 'REJECT'
  } else if (action === 'cancel') {
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING collections can be cancelled' }, { status: 400 })
    }
    updateValues = { ...updateValues, status: 'CANCELLED' }
    auditAction = 'CANCEL'
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const [updated] = await db
    .update(collections)
    .set(updateValues)
    .where(eq(collections.id, id))
    .returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: auditAction,
    entity_type: 'collection',
    entity_id: id,
    before_data: JSON.stringify({ status: existing.status }),
    after_data: JSON.stringify({ status: updated.status, ...(reason ? { rejected_reason: reason } : {}) }),
  })

  return NextResponse.json(updated)
}
