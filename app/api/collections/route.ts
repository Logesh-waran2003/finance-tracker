import { db } from '@/lib/db'
import { collections, customers, notifications, profiles, dues, loans } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte, sql, isNull } from 'drizzle-orm'
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

  // Freeform cap — if no due_id, amount cannot exceed real outstanding (server-side guard)
  if (!due_id) {
    const [custRow] = await db
      .select({ opening_balance: customers.opening_balance })
      .from(customers)
      .where(eq(customers.id, customer_id))
      .limit(1)

    if (!custRow) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const [duesAgg] = await db
      .select({ total: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')` })
      .from(dues)
      .where(and(
        eq(dues.customer_id, customer_id),
        sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`,
        isNull(dues.deleted_at),
      ))

    const [freeformAgg] = await db
      .select({ total: sql<string>`coalesce(sum(${collections.amount}), '0')` })
      .from(collections)
      .where(and(
        eq(collections.customer_id, customer_id),
        eq(collections.status, 'CONFIRMED'),
        isNull(collections.due_id),
        isNull(collections.deleted_at),
      ))

    const [loanAgg] = await db
      .select({ total: sql<string>`coalesce(sum(${loans.total_outstanding}), '0')` })
      .from(loans)
      .where(and(
        eq(loans.customer_id, customer_id),
        sql`${loans.status} NOT IN ('COMPLETED', 'CANCELLED', 'DRAFT')`,
      ))

    const outstandingCents = Math.max(0, Math.round(
      parseFloat(custRow.opening_balance as string ?? '0') * 100
      + parseFloat(duesAgg?.total ?? '0') * 100
      + parseFloat(loanAgg?.total ?? '0') * 100
      - parseFloat(freeformAgg?.total ?? '0') * 100
    ))

    if (outstandingCents <= 0) {
      return NextResponse.json({ error: 'This customer has no outstanding balance' }, { status: 400 })
    }
    if (Math.round(amount * 100) > outstandingCents) {
      return NextResponse.json({
        error: `Amount exceeds outstanding balance of ₹${(outstandingCents / 100).toLocaleString('en-IN')}`,
      }, { status: 400 })
    }
  }

  try {
    const result = await createCollection(db, {
      agentId: actor.id,
      branchId: actor.branch_id,
      actorName: actor.name,
      actorEmail: actor.email,
      customerId: customer_id,
      dueId: due_id ?? undefined,
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

    // Fire-and-forget: notify all active admins in the same branch
    if (result.created) {
      const customerName = await db
        .select({ full_name: customers.full_name })
        .from(customers)
        .where(eq(customers.id, customer_id))
        .limit(1)
        .then(r => r[0]?.full_name ?? 'Unknown customer')

      const adminConditions = actor.branch_id
        ? and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true), eq(profiles.branch_id, actor.branch_id))
        : and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true))

      db.select({ id: profiles.id })
        .from(profiles)
        .where(adminConditions)
        .then(admins => {
          if (admins.length === 0) return
          return db.insert(notifications).values(
            admins.map(a => ({
              recipient_id: a.id,
              type: 'GENERAL' as const,
              title: 'New Collection Pending',
              body: `${actor.name} collected ₹${amount.toLocaleString('en-IN')} from ${customerName} — pending your confirmation`,
              reference_id: result.collection.id,
              reference_type: 'collection',
            }))
          )
        })
        .catch(() => { /* notification failure must not break the collection */ })
    }

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
