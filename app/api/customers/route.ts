import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function GET() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') {
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

  const outstanding = await db.select({
    customer_id: dues.customer_id,
    total: sql<string>`sum(${dues.outstanding_amount})`,
  }).from(dues)
    .where(sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`)
    .groupBy(dues.customer_id)

  const outstandingMap = new Map(outstanding.map(o => [o.customer_id, o.total ?? '0']))

  return NextResponse.json(rows.map(r => ({
    ...r,
    outstanding_total: String(
      parseFloat(outstandingMap.get(r.id) ?? '0') + parseFloat(r.opening_balance as string ?? '0')
    ),
  })))
}
