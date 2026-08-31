import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { auth } from '@/auth'
import type { Session } from 'next-auth'

export async function POST() {
  try {
    const session = (await auth()) as Session | null
    if (session?.user?.id) {
      await db.insert(auditLogs).values({
        actor_id: session.user.id,
        actor_name: session.user.name ?? '',
        actor_email: session.user.email ?? '',
        action: 'LOGOUT',
        entity_type: 'session',
        entity_id: session.user.id,
      })
    }
  } catch { /* fire and forget — never block logout */ }

  const cookieStore = await cookies()
  cookieStore.delete('next-auth.session-token')
  cookieStore.delete('__Secure-next-auth.session-token')
  return NextResponse.json({ ok: true })
}
