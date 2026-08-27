import { db } from '@/lib/db'
import { loanRequests, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') ?? 'ALL'

  const rows = await db.execute(sql`
    SELECT
      lr.*,
      p.full_name       AS agent_name,
      c.full_name       AS customer_name,
      c.customer_code   AS customer_code
    FROM loan_requests lr
    LEFT JOIN profiles  p ON p.id = lr.requested_by
    LEFT JOIN customers c ON c.id = lr.customer_id
    WHERE 1=1
      ${actor.branch_id ? sql`AND lr.branch_id = ${actor.branch_id}` : sql``}
      ${statusFilter !== 'ALL' ? sql`AND lr.status = ${statusFilter}` : sql``}
    ORDER BY lr.created_at DESC
    LIMIT 200
  `)

  return NextResponse.json(rows)
}
