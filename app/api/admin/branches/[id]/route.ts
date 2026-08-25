import { db } from '@/lib/db'
import { branches } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, updateBranchSchema } from '@/lib/validation'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: branch-scoped admin can only modify their own branch
  if (actor.branch_id && actor.branch_id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = await parseBody(request, updateBranchSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const updates: Record<string, unknown> = { updated_at: new Date() }
  const fields = ['name', 'address', 'city', 'state', 'phone', 'email', 'is_active'] as const
  for (const key of fields) {
    if (data[key] !== undefined) updates[key] = data[key]
  }
  if (data.code !== undefined) updates.code = data.code.toUpperCase()

  const [updated] = await db.update(branches).set(updates).where(eq(branches.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
