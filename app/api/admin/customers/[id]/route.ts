import { db } from '@/lib/db'
import { customers, dues, collections, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, updateCustomerSchema } from '@/lib/validation'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: ensure customer belongs to admin's branch
  const customer = await db
    .select()
    .from(customers)
    .where(
      actor.branch_id
        ? and(eq(customers.id, id), eq(customers.branch_id, actor.branch_id))
        : eq(customers.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [duesList, collectionsList] = await Promise.all([
    db.select().from(dues)
      .where(and(eq(dues.customer_id, id), isNull(dues.deleted_at)))
      .orderBy(dues.created_at),
    db.select().from(collections)
      .where(and(eq(collections.customer_id, id), isNull(collections.deleted_at)))
      .orderBy(collections.collected_at),
  ])

  return NextResponse.json({ customer, dues: duesList, collections: collectionsList })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  // IDOR: fetch with branch guard before updating
  const before = await db
    .select()
    .from(customers)
    .where(
      actor.branch_id
        ? and(eq(customers.id, id), eq(customers.branch_id, actor.branch_id))
        : eq(customers.id, id)
    )
    .limit(1)
    .then(r => r[0])

  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = await parseBody(request, updateCustomerSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const updates: Record<string, unknown> = { updated_at: new Date() }
  const fields = [
    'full_name', 'customer_code', 'phone', 'email', 'address', 'area', 'city', 'state',
    'pincode', 'assigned_agent_id', 'opening_balance', 'is_active', 'notes',
  ] as const
  for (const key of fields) {
    if (data[key] !== undefined) updates[key] = data[key] === '' ? null : data[key]
  }
  if (data.gps_lat !== undefined) updates.gps_lat = data.gps_lat != null ? String(data.gps_lat) : null
  if (data.gps_lng !== undefined) updates.gps_lng = data.gps_lng != null ? String(data.gps_lng) : null
  // Admins cannot move a customer to a different branch
  if (data.branch_id !== undefined && !actor.branch_id) {
    updates.branch_id = data.branch_id
  }

  const [updated] = await db.update(customers).set(updates).where(eq(customers.id, id)).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: data.is_active === false ? 'DEACTIVATE' : 'UPDATE',
    entity_type: 'customer',
    entity_id: id,
    before_data: { full_name: before.full_name, is_active: before.is_active },
    after_data: { full_name: updated.full_name, is_active: updated.is_active },
    branch_id: actor.branch_id,
  })

  return NextResponse.json(updated)
}
