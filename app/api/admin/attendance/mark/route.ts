import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, adminMarkAttendanceSchema } from '@/lib/validation'

export async function POST(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, adminMarkAttendanceSchema)
  if (!parsed.ok) return parsed.response
  const { employee_id, date, status, notes } = parsed.data

  // Branch isolation: verify the target employee belongs to admin's branch
  if (actor.branch_id) {
    const employee = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, employee_id), eq(profiles.branch_id, actor.branch_id)))
      .limit(1)
      .then(r => r[0])
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
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
        corrected_by: actor.id,
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
      branch_id: actor.branch_id,
      date,
      status,
      notes: notes ?? null,
    })
    .returning()

  return NextResponse.json(record, { status: 201 })
}
