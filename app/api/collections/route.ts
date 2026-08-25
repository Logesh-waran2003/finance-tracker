import { db } from '@/lib/db'
import { collections, customers } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { requireRole, requireCustomerAccess, isResponse } from '@/lib/auth/authorize'
import { parseBody, createCollectionSchema } from '@/lib/validation'
import { createCollection } from '@/lib/modules/collections/service'
import { ServiceError } from '@/lib/modules/errors'

export async function POST(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, createCollectionSchema)
  if (!parsed.ok) return parsed.response

  const {
    customer_id, due_id, amount, payment_mode, payment_reference,
    notes, gps_lat, gps_lng, gps_accuracy, idempotency_key,
  } = parsed.data

  // Verify customer access server-side (agent must be assigned)
  const accessErr = await requireCustomerAccess(actor, customer_id)
  if (accessErr) return accessErr

  try {
    const result = await createCollection(db, {
      agentId: actor.id,
      branchId: actor.branch_id,
      actorName: actor.name,
      actorEmail: actor.email,
      customerId: customer_id,
      dueId: due_id,
      amount,
      paymentMode: payment_mode,
      paymentReference: payment_reference,
      notes,
      gpsLat: gps_lat,
      gpsLng: gps_lng,
      gpsAccuracy: gps_accuracy,
      idempotencyKey: idempotency_key,
    })
    const status = result.created ? 201 : 200
    return NextResponse.json(result.collection, { status })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}

export async function GET(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const dateFilter = url.searchParams.get('date')

  const conditions: ReturnType<typeof eq>[] = [
    eq(collections.agent_id, actor.id),
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
