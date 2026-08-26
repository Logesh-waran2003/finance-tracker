import { db } from '@/lib/db'
import { customers, dues, profiles, auditLogs, collections } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, createCustomerSchema } from '@/lib/validation'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const search = url.searchParams.get('search') ?? ''
  const agent_id = url.searchParams.get('agent_id') ?? ''
  const branch_id = url.searchParams.get('branch_id') ?? ''
  const is_active = url.searchParams.get('is_active') ?? ''

  const rows = await db.select({
    id: customers.id,
    customer_code: customers.customer_code,
    full_name: customers.full_name,
    phone: customers.phone,
    area: customers.area,
    city: customers.city,
    assigned_agent_id: customers.assigned_agent_id,
    agent_name: profiles.full_name,
    branch_id: customers.branch_id,
    opening_balance: customers.opening_balance,
    is_active: customers.is_active,
    created_at: customers.created_at,
  }).from(customers)
    .leftJoin(profiles, eq(customers.assigned_agent_id, profiles.id))
    // Branch isolation — admin only sees customers for their branch
    .where(actor.branch_id ? eq(customers.branch_id, actor.branch_id) : undefined)

  let filtered = rows
  if (search) filtered = filtered.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_code.toLowerCase().includes(search.toLowerCase()) ||
    (r.phone ?? '').includes(search)
  )
  if (agent_id) filtered = filtered.filter(r => r.assigned_agent_id === agent_id)
  // Admins cannot use branch_id param to escape their own branch
  if (branch_id && !actor.branch_id) filtered = filtered.filter(r => r.branch_id === branch_id)
  if (is_active === 'true') filtered = filtered.filter(r => r.is_active === true)
  if (is_active === 'false') filtered = filtered.filter(r => r.is_active === false)

  // Calculate outstanding per customer (soft-delete aware)
  const [outstanding, freeformCollections] = await Promise.all([
    db.select({
      customer_id: dues.customer_id,
      total: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')`,
    }).from(dues)
      .where(and(
        sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`,
        isNull(dues.deleted_at)
      ))
      .groupBy(dues.customer_id),

    db.select({
      customer_id: collections.customer_id,
      total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    }).from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        isNull(collections.due_id),
        isNull(collections.deleted_at)
      ))
      .groupBy(collections.customer_id),
  ])

  const outstandingMap = new Map(outstanding.map(o => [o.customer_id, o.total ?? '0']))
  const freeformMap = new Map(freeformCollections.map(f => [f.customer_id, f.total ?? '0']))

  const result = filtered.map(r => ({
    ...r,
    outstanding_total: String(
      Math.max(0,
        parseFloat(outstandingMap.get(r.id) ?? '0')
        + parseFloat(r.opening_balance as string ?? '0')
        - parseFloat(freeformMap.get(r.id) ?? '0')
      )
    ),
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, createCustomerSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const customer_code = data.customer_code || `CUST-${Date.now().toString().slice(-6)}`

  const [customer] = await db.insert(customers).values({
    customer_code,
    full_name: data.full_name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    address: data.address ?? null,
    area: data.area ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    pincode: data.pincode ?? null,
    gps_lat: data.gps_lat != null ? String(data.gps_lat) : null,
    gps_lng: data.gps_lng != null ? String(data.gps_lng) : null,
    assigned_agent_id: data.assigned_agent_id ?? null,
    // Always assign to admin's branch; override only if admin has no branch (super-admin)
    branch_id: actor.branch_id ?? (data.branch_id ?? null),
    opening_balance: data.opening_balance != null ? String(data.opening_balance) : '0',
    is_active: true,
    notes: data.notes ?? null,
    created_by: actor.id,
  }).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'CREATE',
    entity_type: 'customer',
    entity_id: customer.id,
    after_data: { customer_code: customer.customer_code, full_name: customer.full_name },
    branch_id: actor.branch_id,
  })

  return NextResponse.json(customer, { status: 201 })
}
