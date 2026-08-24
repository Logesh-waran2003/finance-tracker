import { auth } from '@/auth'
import { db } from '@/lib/db'
import { dues, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id) return null
  if ((s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const customer_id = url.searchParams.get('customer_id')
  if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const list = await db.select().from(dues).where(eq(dues.customer_id, customer_id)).orderBy(dues.created_at)
  return NextResponse.json(list)
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  if (!body.customer_id || !body.amount) {
    return NextResponse.json({ error: 'customer_id and amount required' }, { status: 400 })
  }
  if (parseFloat(body.amount) <= 0) {
    return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 })
  }

  const [due] = await db.insert(dues).values({
    customer_id: body.customer_id,
    invoice_number: body.invoice_number ?? null,
    reference: body.reference ?? null,
    amount: String(body.amount),
    outstanding_amount: String(body.amount), // starts equal to amount
    due_date: body.due_date ?? null,
    status: 'OPEN',
    notes: body.notes ?? null,
    created_by: actor.id as string,
  }).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'CREATE',
    entity_type: 'due',
    entity_id: due.id,
    after_data: JSON.stringify({ amount: due.amount, customer_id: due.customer_id }),
  })

  return NextResponse.json(due, { status: 201 })
}
