import { auth } from '@/auth'
import { db } from '@/lib/db'
import { collections, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1)
    .then(r => r[0])

  if (!existing) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const role = (session.user as any).role
  // Agents can only cancel their own collections; admins covered by admin route
  if (existing.agent_id !== session.user.id) {
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
    actor_id: session.user.id,
    actor_name: session.user.name ?? '',
    action: 'CANCEL',
    entity_type: 'collection',
    entity_id: id,
    before_data: JSON.stringify({ status: 'PENDING' }),
    after_data: JSON.stringify({ status: 'CANCELLED' }),
  })

  return NextResponse.json(updated)
}
