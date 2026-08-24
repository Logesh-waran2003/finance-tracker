import { auth } from '@/auth'
import { db } from '@/lib/db'
import { attendance, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function requireAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await auth()) as Session | null
  const actor = requireAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { status, check_in_at, check_out_at, notes } = body

  const existing = await db
    .select()
    .from(attendance)
    .where(eq(attendance.id, id))
    .limit(1)
    .then(r => r[0])

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date()
  const updateData: Record<string, unknown> = {
    corrected_by: actor.id as string,
    corrected_at: now,
    updated_at: now,
  }
  if (status !== undefined) updateData.status = status
  if (check_in_at !== undefined) updateData.check_in_at = check_in_at ? new Date(check_in_at) : null
  if (check_out_at !== undefined) updateData.check_out_at = check_out_at ? new Date(check_out_at) : null
  if (notes !== undefined) updateData.notes = notes

  const [updated] = await db
    .update(attendance)
    .set(updateData as any)
    .where(eq(attendance.id, id))
    .returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'ATTENDANCE_CORRECTION',
    entity_type: 'attendance',
    entity_id: id,
    before_data: JSON.stringify({
      status: existing.status,
      check_in_at: existing.check_in_at,
      check_out_at: existing.check_out_at,
      notes: existing.notes,
    }),
    after_data: JSON.stringify({
      status: updated.status,
      check_in_at: updated.check_in_at,
      check_out_at: updated.check_out_at,
      notes: updated.notes,
    }),
  })

  return NextResponse.json(updated)
}
