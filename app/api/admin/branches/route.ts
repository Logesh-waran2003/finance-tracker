import { auth } from '@/auth'
import { db } from '@/lib/db'
import { branches } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function GET() {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const data = await db.select().from(branches).orderBy(asc(branches.name))
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  if (!body.name || !body.code) {
    return NextResponse.json({ error: 'name and code are required' }, { status: 400 })
  }

  const [branch] = await db.insert(branches).values({
    name: body.name,
    code: body.code.toUpperCase(),
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    is_active: true,
  }).returning()

  return NextResponse.json(branch, { status: 201 })
}
