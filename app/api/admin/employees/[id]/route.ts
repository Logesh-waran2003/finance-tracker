import { db } from '@/lib/db'
import { profiles, auditLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, updateEmployeeSchema } from '@/lib/validation'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: branch guard
  const employee = await db
    .select()
    .from(profiles)
    .where(
      actor.branch_id
        ? and(eq(profiles.id, id), eq(profiles.branch_id, actor.branch_id))
        : eq(profiles.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { password_hash: _, ...safe } = employee
  return NextResponse.json(safe)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: branch guard before reading body
  const before = await db
    .select()
    .from(profiles)
    .where(
      actor.branch_id
        ? and(eq(profiles.id, id), eq(profiles.branch_id, actor.branch_id))
        : eq(profiles.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = await parseBody(request, updateEmployeeSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const updates: Record<string, unknown> = { updated_at: new Date() }
  const fields = [
    'full_name', 'email', 'role', 'employee_code',
    'department', 'designation', 'joining_date', 'phone', 'is_active',
  ] as const
  for (const key of fields) {
    if (data[key] !== undefined) updates[key] = data[key]
  }
  // Super-admin (no branch_id) may reassign branch; branch-scoped admin cannot
  if (data.branch_id !== undefined && !actor.branch_id) {
    updates.branch_id = data.branch_id
  }

  if (data.password != null && data.password !== '') {
    updates.password_hash = await bcrypt.hash(data.password, 12)
    // Invalidate outstanding JWTs by bumping the version counter
    updates.password_version = before.password_version + 1
  }

  if (Object.keys(updates).length === 1) {
    // Only updated_at was set — nothing meaningful was provided
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  let after: typeof profiles.$inferSelect
  try {
    ;[after] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, id))
      .returning()
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string }
    if (err?.message?.includes('unique') || err?.code === '23505') {
      return NextResponse.json({ error: 'Email or employee code already exists' }, { status: 409 })
    }
    throw e
  }

  const { password_hash: _bh, ...safeBefore } = before
  const { password_hash: _ah, ...safeAfter } = after

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'UPDATE',
    entity_type: 'employee',
    entity_id: id,
    before_data: safeBefore,
    after_data: safeAfter,
    branch_id: actor.branch_id,
  })

  return NextResponse.json(safeAfter)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: branch guard
  const before = await db
    .select()
    .from(profiles)
    .where(
      actor.branch_id
        ? and(eq(profiles.id, id), eq(profiles.branch_id, actor.branch_id))
        : eq(profiles.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [after] = await db
    .update(profiles)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(profiles.id, id))
    .returning()

  const { password_hash: _bh, ...safeBefore } = before
  const { password_hash: _ah, ...safeAfter } = after

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'DEACTIVATE',
    entity_type: 'employee',
    entity_id: id,
    before_data: safeBefore,
    after_data: safeAfter,
    branch_id: actor.branch_id,
  })

  return NextResponse.json({ ok: true })
}
