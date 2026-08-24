import { auth } from '@/auth'
import { db } from '@/lib/db'
import { profiles, auditLogs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import type { Session } from 'next-auth'

function getAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const employee = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then(r => r[0])

  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { password_hash: _, ...safe } = employee
  return NextResponse.json(safe)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const before = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then(r => r[0])

  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const allowed = [
    'full_name', 'email', 'role', 'employee_code', 'branch_id',
    'department', 'designation', 'joining_date', 'phone', 'is_active',
  ] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (body.password !== undefined && body.password !== '') {
    if (String(body.password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    updates.password_hash = await bcrypt.hash(String(body.password), 12)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date()

  let after
  try {
    ;[after] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, id))
      .returning()
  } catch (e: any) {
    if (e?.message?.includes('unique') || e?.code === '23505') {
      return NextResponse.json({ error: 'Email or employee code already exists' }, { status: 409 })
    }
    throw e
  }

  const { password_hash: _bh, ...safeBefore } = before
  const { password_hash: _ah, ...safeAfter } = after

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'UPDATE',
    entity_type: 'employee',
    entity_id: id,
    before_data: JSON.stringify(safeBefore),
    after_data: JSON.stringify(safeAfter),
  })

  return NextResponse.json(safeAfter)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const before = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
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
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'DEACTIVATE',
    entity_type: 'employee',
    entity_id: id,
    before_data: JSON.stringify(safeBefore),
    after_data: JSON.stringify(safeAfter),
  })

  return NextResponse.json({ ok: true })
}
