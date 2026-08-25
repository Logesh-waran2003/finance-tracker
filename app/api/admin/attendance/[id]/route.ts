import { db } from '@/lib/db'
import { attendance, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, adminCorrectAttendanceSchema } from '@/lib/validation'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: branch isolation on fetch
  const existing = await db
    .select()
    .from(attendance)
    .where(
      actor.branch_id
        ? and(eq(attendance.id, id), eq(attendance.branch_id, actor.branch_id))
        : eq(attendance.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = await parseBody(request, adminCorrectAttendanceSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const now = new Date()
  const updateData: Record<string, unknown> = {
    corrected_by: actor.id,
    corrected_at: now,
    updated_at: now,
  }
  if (data.status !== undefined) updateData.status = data.status
  if (data.check_in_at !== undefined) updateData.check_in_at = data.check_in_at ? new Date(data.check_in_at) : null
  if (data.check_out_at !== undefined) updateData.check_out_at = data.check_out_at ? new Date(data.check_out_at) : null
  if (data.notes !== undefined) updateData.notes = data.notes

  const [updated] = await db
    .update(attendance)
    .set(updateData as any)
    .where(eq(attendance.id, id))
    .returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'ATTENDANCE_CORRECTION',
    entity_type: 'attendance',
    entity_id: id,
    before_data: {
      status: existing.status,
      check_in_at: existing.check_in_at,
      check_out_at: existing.check_out_at,
      notes: existing.notes,
    },
    after_data: {
      status: updated.status,
      check_in_at: updated.check_in_at,
      check_out_at: updated.check_out_at,
      notes: updated.notes,
    },
    branch_id: actor.branch_id,
  })

  return NextResponse.json(updated)
}
