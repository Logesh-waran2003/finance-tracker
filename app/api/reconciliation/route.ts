import { db } from '@/lib/db'
import { reconciliations, collections, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, sql, sum } from 'drizzle-orm'
import { requireRole, isResponse } from '@/lib/auth/authorize'
import { parseBody, createReconciliationSchema } from '@/lib/validation'
import { createReconciliation } from '@/lib/modules/reconciliation/service'
import { ServiceError } from '@/lib/modules/errors'

export async function GET(_request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  // Server-side: always use session user's id, never trust client
  const agentId = actor.id
  const today = new Date().toISOString().split('T')[0]

  // Calculate actual confirmed CASH collections server-side
  const [cashPosition] = await db
    .select({ total: sum(collections.amount) })
    .from(collections)
    .where(
      and(
        eq(collections.agent_id, agentId),
        eq(collections.payment_mode, 'CASH'),
        eq(collections.status, 'CONFIRMED'),
        sql`DATE(${collections.collected_at} AT TIME ZONE 'Asia/Kolkata') = ${today}::date`,
      ),
    )

  const [submitted] = await db
    .select({ total: sum(reconciliations.cash_submitted) })
    .from(reconciliations)
    .where(and(eq(reconciliations.agent_id, agentId), eq(reconciliations.date, today)))

  const history = await db
    .select({
      id: reconciliations.id,
      date: reconciliations.date,
      cash_collected: reconciliations.cash_collected,
      cash_submitted: reconciliations.cash_submitted,
      difference: reconciliations.difference,
      status: reconciliations.status,
      notes: reconciliations.notes,
      verified_by: reconciliations.verified_by,
      verified_at: reconciliations.verified_at,
      rejection_reason: reconciliations.rejection_reason,
      created_at: reconciliations.created_at,
      verifier_name: profiles.full_name,
    })
    .from(reconciliations)
    .leftJoin(profiles, eq(reconciliations.verified_by, profiles.id))
    .where(eq(reconciliations.agent_id, agentId))
    .orderBy(desc(reconciliations.date))
    .limit(30)

  const confirmedCash = parseFloat(cashPosition?.total ?? '0')
  const submittedToday = parseFloat(submitted?.total ?? '0')

  return NextResponse.json({
    cashPosition: {
      confirmed_cash: confirmedCash,
      submitted_today: submittedToday,
      pending_handover: Math.max(0, confirmedCash - submittedToday),
    },
    history,
  })
}

export async function POST(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, createReconciliationSchema)
  if (!parsed.ok) return parsed.response

  const { date, cash_submitted, notes } = parsed.data

  try {
    const record = await createReconciliation(db, {
      agentId: actor.id,
      branchId: actor.branch_id,
      actorName: actor.name,
      actorEmail: actor.email,
      date,
      cashSubmitted: cash_submitted,
      notes,
    })
    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/reconciliation]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
