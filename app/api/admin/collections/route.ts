import { db } from '@/lib/db'
import { collections, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const agentId = url.searchParams.get('agent_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  const conditions: ReturnType<typeof eq>[] = [
    // Soft-delete: never return cancelled-and-deleted rows
    isNull(collections.deleted_at) as any,
  ]

  // Branch isolation — admin only sees their own branch; null branch_id = unrestricted
  if (actor.branch_id) {
    conditions.push(eq(collections.branch_id, actor.branch_id) as any)
  }

  if (statusFilter) conditions.push(eq(collections.status, statusFilter as any) as any)
  if (agentId) conditions.push(eq(collections.agent_id, agentId) as any)
  if (start) conditions.push(gte(collections.collected_at, new Date(start + 'T00:00:00.000Z')) as any)
  if (end) conditions.push(lte(collections.collected_at, new Date(end + 'T23:59:59.999Z')) as any)

  const rows = await db
    .select({
      id: collections.id,
      collection_number: collections.collection_number,
      customer_id: collections.customer_id,
      customer_name: customers.full_name,
      agent_id: collections.agent_id,
      agent_name: profiles.full_name,
      due_id: collections.due_id,
      amount: collections.amount,
      payment_mode: collections.payment_mode,
      payment_reference: collections.payment_reference,
      notes: collections.notes,
      status: collections.status,
      rejected_reason: collections.rejected_reason,
      confirmed_at: collections.confirmed_at,
      collected_at: collections.collected_at,
      created_at: collections.created_at,
    })
    .from(collections)
    .leftJoin(customers, eq(collections.customer_id, customers.id))
    .leftJoin(profiles, eq(collections.agent_id, profiles.id))
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(desc(collections.collected_at))
    .limit(100)

  return NextResponse.json(rows)
}
