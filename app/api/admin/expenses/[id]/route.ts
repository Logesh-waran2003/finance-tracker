import { auth } from '@/auth'
import { db } from '@/lib/db'
import { expenses, auditLogs } from '@/lib/db/schema'
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

  const expense = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1).then(r => r[0])
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (expense.status !== 'PENDING') return NextResponse.json({ error: 'Only PENDING expenses can be actioned' }, { status: 400 })

  const now = new Date()
  const updates: Record<string, unknown> = { updated_at: now }
  let auditAction = ''

  if (action === 'approve') {
    updates.status = 'APPROVED'
    updates.approved_by = actor.id as string
    updates.approved_at = now
    auditAction = 'APPROVE'
  } else if (action === 'reject') {
    if (!reason) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    updates.status = 'REJECTED'
    updates.rejection_reason = reason
    auditAction = 'REJECT'
  } else {
    return NextResponse.json({ error: 'Invalid action. Use approve or reject' }, { status: 400 })
  }

  const [updated] = await db.update(expenses).set(updates as any).where(eq(expenses.id, id)).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: auditAction,
    entity_type: 'expense',
    entity_id: id,
    before_data: JSON.stringify({ status: expense.status }),
    after_data: JSON.stringify({ status: updated.status }),
  })

  return NextResponse.json(updated)
}
