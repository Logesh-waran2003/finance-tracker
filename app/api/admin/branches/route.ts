import { db } from '@/lib/db'
import { branches, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, createBranchSchema } from '@/lib/validation'

export async function GET() {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

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
  const actor = userOrRes

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

  db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'CREATE',
    entity_type: 'branch',
    entity_id: branch.id,
    after_data: { name: branch.name, code: branch.code },
    branch_id: actor.branch_id,
  }).catch(() => {})

  return NextResponse.json(branch, { status: 201 })
}
