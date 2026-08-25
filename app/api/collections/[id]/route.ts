import { db } from '@/lib/db'
import { collections, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireRole, isResponse, withErrorHandler } from '@/lib/auth/authorize'
import { uuidSchema } from '@/lib/validation'

export const PATCH = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // Validate UUID format before hitting the DB
  const idParse = uuidSchema.safeParse(id)
  if (!idParse.success) {
    return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
  }

  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1)
    .then(r => r[0])

  if (!existing) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  // Agents can only cancel their own PENDING collections
  if (actor.role !== 'ADMIN' && existing.agent_id !== actor.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only PENDING collections can be cancelled' }, { status: 400 })
  }

  const now = new Date()
  const [updated] = await db
    .update(collections)
    .set({ status: 'CANCELLED', updated_at: now })
    .where(eq(collections.id, id))
    .returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'CANCEL',
    entity_type: 'collection',
    entity_id: id,
    before_data: { status: 'PENDING' },
    after_data: { status: 'CANCELLED' },
    branch_id: actor.branch_id,
  })

  return NextResponse.json(updated)
})
