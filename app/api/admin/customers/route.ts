import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues, profiles, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id) return null
  if ((s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  let filtered = rows
  if (search) filtered = filtered.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_code.toLowerCase().includes(search.toLowerCase()) ||
    (r.phone ?? '').includes(search)
  )
  if (agent_id) filtered = filtered.filter(r => r.assigned_agent_id === agent_id)
  if (branch_id) filtered = filtered.filter(r => r.branch_id === branch_id)
  if (is_active === 'true') filtered = filtered.filter(r => r.is_active === true)
  if (is_active === 'false') filtered = filtered.filter(r => r.is_active === false)

  // Calculate outstanding per customer
  const outstanding = await db.select({
    customer_id: dues.customer_id,
    total: sql<string>`sum(${dues.outstanding_amount})`,
  }).from(dues)
    .where(and(
      sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`
    ))
    .groupBy(dues.customer_id)

  const outstandingMap = new Map(outstanding.map(o => [o.customer_id, o.total ?? '0']))

  const result = filtered.map(r => ({
    ...r,
    outstanding_total: outstandingMap.get(r.id) ?? '0',
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  if (!body.full_name) return NextResponse.json({ error: 'full_name is required' }, { status: 400 })

  const customer_code = body.customer_code || `CUST-${Date.now().toString().slice(-6)}`

  const [customer] = await db.insert(customers).values({
    customer_code,
    full_name: body.full_name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    area: body.area ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    pincode: body.pincode ?? null,
    gps_lat: body.gps_lat ?? null,
    gps_lng: body.gps_lng ?? null,
    assigned_agent_id: body.assigned_agent_id || null,
    branch_id: body.branch_id || null,
    opening_balance: body.opening_balance ? String(body.opening_balance) : '0',
    is_active: true,
    notes: body.notes ?? null,
    created_by: actor.id as string,
  }).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'CREATE',
    entity_type: 'customer',
    entity_id: customer.id,
    after_data: JSON.stringify({ customer_code: customer.customer_code, full_name: customer.full_name }),
  })

  return NextResponse.json(customer, { status: 201 })
}
