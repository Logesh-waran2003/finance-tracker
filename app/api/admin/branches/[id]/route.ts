import { auth } from '@/auth'
import { db } from '@/lib/db'
import { branches } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const allowed = ['name', 'code', 'address', 'city', 'state', 'phone', 'email', 'is_active']
  const updates: Record<string, unknown> = { updated_at: new Date() }
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const [updated] = await db.update(branches).set(updates).where(eq(branches.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
