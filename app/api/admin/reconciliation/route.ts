import { auth } from '@/auth'
import { db } from '@/lib/db'
import { reconciliations, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id || (s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const agent_id = url.searchParams.get('agent_id')
  const status = url.searchParams.get('status')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  const conditions: any[] = []
  if (agent_id) conditions.push(eq(reconciliations.agent_id, agent_id))
  if (status) conditions.push(eq(reconciliations.status, status as any))
  if (start) conditions.push(gte(reconciliations.date, start))
  if (end) conditions.push(lte(reconciliations.date, end))

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
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(reconciliations.date))
    .limit(200)

  return NextResponse.json(rows)
}
