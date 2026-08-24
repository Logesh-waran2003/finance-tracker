import { auth } from '@/auth'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function GET() {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const data = await db.select().from(settings).limit(1).then(r => r[0] ?? null)
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const allowed = ['company_name', 'currency', 'currency_symbol', 'timezone', 'financial_year_start']
  const updates: Record<string, unknown> = { updated_at: new Date() }
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const existing = await db.select().from(settings).limit(1).then(r => r[0])
  let result
  if (existing) {
    const [updated] = await db.update(settings).set(updates).where(eq(settings.id, existing.id)).returning()
    result = updated
  } else {
    const [inserted] = await db.insert(settings).values(updates as any).returning()
    result = inserted
  }

  return NextResponse.json(result)
}
