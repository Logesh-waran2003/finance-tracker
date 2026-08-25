import { db } from '@/lib/db'
import { dues } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { requireRole, requireCustomerAccess, isResponse } from '@/lib/auth/authorize'
import { uuidSchema } from '@/lib/validation'

export async function GET(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const customer_id = url.searchParams.get('customer_id')

  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
  }

  // Validate UUID format
  const idParse = uuidSchema.safeParse(customer_id)
  if (!idParse.success) {
    return NextResponse.json({ error: 'customer_id must be a valid UUID' }, { status: 400 })
  }

  // IDOR fix: verify agent is assigned to this customer (ADMIN bypasses)
  const accessErr = await requireCustomerAccess(actor, customer_id)
  if (accessErr) return accessErr

  const rows = await db
    .select()
    .from(dues)
    .where(
      and(
        eq(dues.customer_id, customer_id),
        sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`
      )
    )
    .orderBy(dues.due_date)

  return NextResponse.json(rows)
}
