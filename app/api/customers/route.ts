import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues, collections, loans } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql, isNull } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function GET() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const agentId = session.user.id

  const rows = await db.select({
    id: customers.id,
    customer_code: customers.customer_code,
    full_name: customers.full_name,
    phone: customers.phone,
    area: customers.area,
    city: customers.city,
    opening_balance: customers.opening_balance,
    is_active: customers.is_active,
    assigned_agent_id: customers.assigned_agent_id,
  }).from(customers)
    .where(and(
      eq(customers.assigned_agent_id, agentId),
      eq(customers.is_active, true)
    ))

  const [duesAgg, freeformAgg, loanAgg] = await Promise.all([
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
    db.select({
      customer_id: loans.customer_id,
      total: sql<string>`coalesce(sum(${loans.total_outstanding}), '0')`,
    }).from(loans)
      .where(sql`${loans.status} NOT IN ('COMPLETED', 'CANCELLED', 'DRAFT')`)
      .groupBy(loans.customer_id),
  ])

  const duesMap = new Map(duesAgg.map(o => [o.customer_id, o.total ?? '0']))
  const freeformMap = new Map(freeformAgg.map(o => [o.customer_id, o.total ?? '0']))
  const loanMap = new Map(loanAgg.map(o => [o.customer_id, o.total ?? '0']))

  return NextResponse.json(rows.map(r => ({
    ...r,
    outstanding_total: String(
      Math.max(0,
        parseFloat(r.opening_balance as string ?? '0')
        + parseFloat(duesMap.get(r.id) ?? '0')
        + parseFloat(loanMap.get(r.id) ?? '0')
        - parseFloat(freeformMap.get(r.id) ?? '0')
      )
    ),
  })))
}
