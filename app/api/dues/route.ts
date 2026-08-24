import { auth } from '@/auth'
import { db } from '@/lib/db'
import { dues } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const customer_id = url.searchParams.get('customer_id')
  if (!customer_id) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })

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
