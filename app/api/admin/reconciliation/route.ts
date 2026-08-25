import { db } from '@/lib/db'
import { reconciliations, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const agent_id = url.searchParams.get('agent_id')
  const status = url.searchParams.get('status')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  const conditions: ReturnType<typeof eq>[] = [
    isNull(reconciliations.deleted_at) as any,
  ]

  // Branch isolation
  if (actor.branch_id) {
    conditions.push(eq(reconciliations.branch_id, actor.branch_id) as any)
  }

  if (agent_id) conditions.push(eq(reconciliations.agent_id, agent_id) as any)
  if (status) conditions.push(eq(reconciliations.status, status as any) as any)
  if (start) conditions.push(gte(reconciliations.date, start) as any)
  if (end) conditions.push(lte(reconciliations.date, end) as any)

  const rows = await db.select({
    id: reconciliations.id,
    agent_id: reconciliations.agent_id,
    agent_name: profiles.full_name,
    date: reconciliations.date,
    cash_collected: reconciliations.cash_collected,
    cash_submitted: reconciliations.cash_submitted,
    difference: reconciliations.difference,
    status: reconciliations.status,
    notes: reconciliations.notes,
    verified_at: reconciliations.verified_at,
    rejection_reason: reconciliations.rejection_reason,
    created_at: reconciliations.created_at,
  }).from(reconciliations)
    .leftJoin(profiles, eq(reconciliations.agent_id, profiles.id))
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(desc(reconciliations.date))
    .limit(200)

  return NextResponse.json(rows)
}
