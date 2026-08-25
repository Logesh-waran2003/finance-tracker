import { db } from '@/lib/db'
import { branches } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, createBranchSchema } from '@/lib/validation'

export async function GET() {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  // Branch isolation — scoped admins only see their own branch; super-admins see all
  const data = await db
    .select()
    .from(branches)
    .where(actor.branch_id ? eq(branches.id, actor.branch_id) : undefined)
    .orderBy(asc(branches.name))
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const parsed = await parseBody(request, createBranchSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const [branch] = await db.insert(branches).values({
    name: data.name,
    code: data.code.toUpperCase(),
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    is_active: true,
  }).returning()

  return NextResponse.json(branch, { status: 201 })
}
