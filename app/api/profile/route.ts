import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireRole, isResponse } from '@/lib/auth/authorize'
import { parseBody, updateProfileSchema } from '@/lib/validation'

export async function GET() {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1)
    .then(r => r[0])

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { password_hash: _, ...safe } = profile
  return NextResponse.json(safe)
}

export async function PATCH(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, updateProfileSchema)
  if (!parsed.ok) return parsed.response

  const updates: Record<string, unknown> = {}
  if (parsed.data.full_name !== undefined) updates.full_name = parsed.data.full_name
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone || null
  if (parsed.data.avatar_url !== undefined) updates.avatar_url = parsed.data.avatar_url || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date()

  const [updated] = await db
    .update(profiles)
    .set(updates)
    .where(eq(profiles.id, actor.id))
    .returning()

  const { password_hash: _, ...safe } = updated
  return NextResponse.json(safe)
}
