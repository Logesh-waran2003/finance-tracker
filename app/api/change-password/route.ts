import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { profiles, auditLogs } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireRole, isResponse } from '@/lib/auth/authorize'
import { parseBody, changePasswordSchema } from '@/lib/validation'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate-limit: 5 attempts per 15 minutes per IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(ip, { windowMs: 15 * 60 * 1000, max: 5, blockMs: 15 * 60 * 1000 })
  if (rl.limited) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many password change attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Reset': String(Date.now() + rl.retryAfterMs),
        },
      }
    )
  }

  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, changePasswordSchema)
  if (!parsed.ok) return parsed.response
  const { current_password, new_password } = parsed.data

  const user = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1)
    .then(r => r[0])

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await bcrypt.compare(current_password, user.password_hash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const new_hash = await bcrypt.hash(new_password, 12)

  await db.transaction(async (tx) => {
    // Increment password_version — existing JWTs carry the old version and will
    // be rejected by the session callback once this value is checked (Step: auth.ts update)
    await tx
      .update(profiles)
      .set({
        password_hash: new_hash,
        password_version: sql`${profiles.password_version} + 1`,
        updated_at: new Date(),
      })
      .where(eq(profiles.id, actor.id))

    await tx.insert(auditLogs).values({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_email: actor.email,
      action: 'PASSWORD_CHANGE',
      entity_type: 'profile',
      entity_id: actor.id,
    })
  })

  return NextResponse.json({ success: true })
}
