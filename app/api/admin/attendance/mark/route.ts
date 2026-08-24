import { auth } from '@/auth'
import { db } from '@/lib/db'
import { attendance } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import type { Session } from 'next-auth'

function requireAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  const actor = requireAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { employee_id, date, status, notes } = body

  if (!employee_id || !date || !status) {
    return NextResponse.json({ error: 'employee_id, date, and status are required' }, { status: 400 })
  }
  if (status !== 'LEAVE' && status !== 'WEEK_OFF') {
    return NextResponse.json({ error: 'status must be LEAVE or WEEK_OFF' }, { status: 400 })
  }

  const existing = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employee_id, employee_id), eq(attendance.date, date)))
    .limit(1)
    .then(r => r[0])

  const now = new Date()

  if (existing) {
    const [updated] = await db
      .update(attendance)
      .set({
        status,
        notes: notes ?? existing.notes,
        check_in_at: null,
        check_out_at: null,
        total_hours: null,
        corrected_by: actor.id as string,
        corrected_at: now,
        updated_at: now,
      })
      .where(eq(attendance.id, existing.id))
      .returning()
    return NextResponse.json(updated)
  }

  const [record] = await db
    .insert(attendance)
    .values({
      employee_id,
      date,
      status,
      notes: notes ?? null,
    })
    .returning()

  return NextResponse.json(record, { status: 201 })
}
