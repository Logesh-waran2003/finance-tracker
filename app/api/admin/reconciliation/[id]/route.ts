import { auth } from '@/auth'
import { db } from '@/lib/db'
import { reconciliations, profiles, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id || (s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { action, reason } = body

  const recon = await db.select().from(reconciliations).where(eq(reconciliations.id, id)).limit(1).then(r => r[0])
  if (!recon) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date()
  const updates: Record<string, unknown> = { updated_at: now }
  let auditAction = ''

  if (action === 'verify') {
    updates.status = 'VERIFIED'
    updates.verified_by = actor.id as string
    updates.verified_at = now
    auditAction = 'VERIFY'
  } else if (action === 'reject') {
    if (!reason) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    updates.status = 'REJECTED'
    updates.rejection_reason = reason
    auditAction = 'REJECT'
  } else {
    return NextResponse.json({ error: 'Invalid action. Use verify or reject' }, { status: 400 })
  }

  const [updated] = await db.update(reconciliations).set(updates as any).where(eq(reconciliations.id, id)).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: auditAction,
    entity_type: 'reconciliation',
    entity_id: id,
    before_data: JSON.stringify({ status: recon.status }),
    after_data: JSON.stringify({ status: updated.status }),
  })

  return NextResponse.json(updated)
}
