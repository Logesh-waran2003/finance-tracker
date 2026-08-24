import { auth } from '@/auth'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1)
    .then(r => r[0])

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Never return password_hash
  const { password_hash: _, ...safe } = profile
  return NextResponse.json(safe)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const allowed = ['full_name', 'phone', 'avatar_url']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date()

  const [updated] = await db
    .update(profiles)
    .set(updates)
    .where(eq(profiles.id, session.user.id))
    .returning()

  const { password_hash: _, ...safe } = updated
  return NextResponse.json(safe)
}
