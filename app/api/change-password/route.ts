import bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { current_password, new_password } = await request.json()

  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'Both fields required' }, { status: 400 })
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const user = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1)
    .then(r => r[0])

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await bcrypt.compare(current_password, user.password_hash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const new_hash = await bcrypt.hash(new_password, 12)
  await db.update(profiles).set({ password_hash: new_hash, updated_at: new Date() }).where(eq(profiles.id, user.id))

  // Audit log
  await db.insert((await import('@/lib/db/schema')).auditLogs).values({
    actor_id: session.user.id,
    actor_name: user.full_name,
    action: 'PASSWORD_CHANGE',
    entity_type: 'profile',
    entity_id: user.id,
  })

  return NextResponse.json({ success: true })
}
