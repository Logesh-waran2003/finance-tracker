import { db } from '@/lib/db'
import { dues, customers, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { withErrorHandler, requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, createDueSchema, uuidSchema } from '@/lib/validation'

export const GET = withErrorHandler(async (request: Request) => {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const customer_id = url.searchParams.get('customer_id')
  if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const parsed = uuidSchema.safeParse(customer_id)
  if (!parsed.success) return NextResponse.json({ error: 'customer_id must be a valid UUID' }, { status: 400 })

  // IDOR: verify the customer belongs to this admin's branch before listing dues
  if (actor.branch_id) {
    const customer = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customer_id), eq(customers.branch_id, actor.branch_id)))
      .limit(1)
      .then(r => r[0])
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const list = await db
    .select()
    .from(dues)
    .where(and(eq(dues.customer_id, customer_id), isNull(dues.deleted_at)))
    .orderBy(dues.created_at)
  return NextResponse.json(list)
})

export const POST = withErrorHandler(async (request: Request) => {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const _parsed = await parseBody(request, createDueSchema)
  if (!_parsed.ok) return _parsed.response
  const data = _parsed.data

  if (parseFloat(String(data.amount)) <= 0) {
    return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 })
  }

  // IDOR: verify customer belongs to admin's branch
  if (actor.branch_id) {
    const customer = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, data.customer_id), eq(customers.branch_id, actor.branch_id)))
      .limit(1)
      .then(r => r[0])
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const [due] = await db.insert(dues).values({
    customer_id: data.customer_id,
    invoice_number: data.invoice_number ?? null,
    reference: data.reference ?? null,
    amount: String(data.amount),
    outstanding_amount: String(data.amount),
    due_date: data.due_date ?? null,
    status: 'OPEN',
    notes: data.notes ?? null,
    penalty_rate: data.penalty_rate != null ? String(data.penalty_rate) : '0',
    created_by: actor.id,
  }).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'CREATE',
    entity_type: 'due',
    entity_id: due.id,
    after_data: { amount: due.amount, customer_id: due.customer_id },
    branch_id: actor.branch_id,
  })

  return NextResponse.json(due, { status: 201 })
})
