import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues, collections, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdminOrAgent(s: Session | null) {
  if (!s?.user?.id) return null
  return s.user
}

function isAdmin(s: Session | null) {
  return (s?.user as any)?.role === 'ADMIN'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  if (!getAdminOrAgent(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const customer = await db.select().from(customers).where(eq(customers.id, id)).limit(1).then(r => r[0])
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // RBAC: agent can only see their assigned customers
  if (!isAdmin(session) && customer.assigned_agent_id !== session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [duesList, collectionsList] = await Promise.all([
    db.select().from(dues).where(eq(dues.customer_id, id)).orderBy(dues.created_at),
    db.select().from(collections).where(eq(collections.customer_id, id)).orderBy(collections.collected_at),
  ])

  return NextResponse.json({ customer, dues: duesList, collections: collectionsList })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const before = await db.select().from(customers).where(eq(customers.id, id)).limit(1).then(r => r[0])
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = ['full_name', 'phone', 'email', 'address', 'area', 'city', 'state', 'pincode',
    'gps_lat', 'gps_lng', 'assigned_agent_id', 'branch_id', 'opening_balance', 'is_active', 'notes', 'customer_code']
  const updates: Record<string, unknown> = { updated_at: new Date() }
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] === '' ? null : body[key]
  }

  const [updated] = await db.update(customers).set(updates).where(eq(customers.id, id)).returning()

  await db.insert(auditLogs).values({
    actor_id: (session?.user?.id ?? '') as string,
    actor_name: ((session?.user as any)?.name ?? '') as string,
    action: body.is_active === false ? 'DEACTIVATE' : 'UPDATE',
    entity_type: 'customer',
    entity_id: id,
    before_data: JSON.stringify({ full_name: before.full_name, is_active: before.is_active }),
    after_data: JSON.stringify({ full_name: updated.full_name, is_active: updated.is_active }),
  })

  return NextResponse.json(updated)
}
