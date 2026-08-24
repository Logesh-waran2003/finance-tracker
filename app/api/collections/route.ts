import { auth } from '@/auth'
import { db } from '@/lib/db'
import { collections, customers, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAgent(s: Session | null) {
  if (!s?.user?.id) return null
  const role = (s.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') return null
  return s.user
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  const actor = getAgent(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { customer_id, due_id, amount, payment_mode, payment_reference, notes,
          gps_lat, gps_lng, gps_accuracy, idempotency_key } = body

  if (!customer_id) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
  if (!amount || parseFloat(amount) <= 0) return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  if (!payment_mode) return NextResponse.json({ error: 'payment_mode is required' }, { status: 400 })

  // Idempotency check
  if (idempotency_key) {
    const existing = await db
      .select()
      .from(collections)
      .where(eq(collections.idempotency_key, idempotency_key))
      .limit(1)
      .then(r => r[0])
    if (existing) return NextResponse.json(existing, { status: 409 })
  }

  // Non-admin must be assigned to this customer
  const role = (actor as any).role
  if (role !== 'ADMIN') {
    const customer = await db
      .select({ assigned_agent_id: customers.assigned_agent_id })
      .from(customers)
      .where(eq(customers.id, customer_id))
      .limit(1)
      .then(r => r[0])
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    if (customer.assigned_agent_id !== actor.id) {
      return NextResponse.json({ error: 'Customer not assigned to you' }, { status: 403 })
    }
  }

  const branchId = (session!.user as any).branch_id ?? null

  const [collection] = await db
    .insert(collections)
    .values({
      customer_id,
      due_id: due_id ?? null,
      agent_id: actor.id as string,
      branch_id: branchId,
      amount: String(amount),
      payment_mode,
      payment_reference: payment_reference ?? null,
      notes: notes ?? null,
      gps_lat: gps_lat != null ? String(gps_lat) : null,
      gps_lng: gps_lng != null ? String(gps_lng) : null,
      gps_accuracy: gps_accuracy != null ? String(gps_accuracy) : null,
      status: 'PENDING',
      idempotency_key: idempotency_key ?? null,
      collected_at: new Date(),
    })
    .returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'CREATE',
    entity_type: 'collection',
    entity_id: collection.id,
    after_data: JSON.stringify({
      collection_number: collection.collection_number,
      amount: collection.amount,
      payment_mode: collection.payment_mode,
      status: collection.status,
    }),
  })

  return NextResponse.json(collection, { status: 201 })
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  const actor = getAgent(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const dateFilter = url.searchParams.get('date')

  const conditions: ReturnType<typeof eq>[] = [
    eq(collections.agent_id, actor.id as string),
  ]
  if (statusFilter) conditions.push(eq(collections.status, statusFilter as any))
  if (dateFilter) {
    conditions.push(gte(collections.collected_at, new Date(dateFilter + 'T00:00:00.000Z')) as any)
    conditions.push(lte(collections.collected_at, new Date(dateFilter + 'T23:59:59.999Z')) as any)
  }

  const rows = await db
    .select({
      id: collections.id,
      collection_number: collections.collection_number,
      customer_id: collections.customer_id,
      customer_name: customers.full_name,
      due_id: collections.due_id,
      amount: collections.amount,
      payment_mode: collections.payment_mode,
      payment_reference: collections.payment_reference,
      notes: collections.notes,
      status: collections.status,
      rejected_reason: collections.rejected_reason,
      collected_at: collections.collected_at,
      confirmed_at: collections.confirmed_at,
      created_at: collections.created_at,
    })
    .from(collections)
    .leftJoin(customers, eq(collections.customer_id, customers.id))
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(desc(collections.collected_at))

  return NextResponse.json(rows)
}
