import { auth } from '@/auth'
import { db } from '@/lib/db'
import { reconciliations, collections, auditLogs, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, sql, sum } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function GET() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentId = session.user.id as string
  const today = new Date().toISOString().split('T')[0]

  // Today's confirmed CASH collections
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

  // Already submitted today
  const [submitted] = await db
    .select({ total: sum(reconciliations.cash_submitted) })
    .from(reconciliations)
    .where(and(eq(reconciliations.agent_id, agentId), eq(reconciliations.date, today)))

  // History (last 30)
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
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentId = session.user.id as string
  const body = await request.json()

  const cashCollected = parseFloat(body.cash_collected ?? '0')
  const cashSubmitted = parseFloat(body.cash_submitted ?? '0')
  const date: string = body.date ?? new Date().toISOString().split('T')[0]

  if (cashSubmitted <= 0) {
    return NextResponse.json({ error: 'cash_submitted must be greater than 0' }, { status: 400 })
  }
  if (cashCollected < 0) {
    return NextResponse.json({ error: 'cash_collected cannot be negative' }, { status: 400 })
  }

  // Fetch agent's branch_id
  const [agent] = await db
    .select({ branch_id: profiles.branch_id })
    .from(profiles)
    .where(eq(profiles.id, agentId))
    .limit(1)

  const [record] = await db
    .insert(reconciliations)
    .values({
      agent_id: agentId,
      branch_id: agent?.branch_id ?? null,
      date,
      cash_collected: String(cashCollected),
      cash_submitted: String(cashSubmitted),
      status: 'PENDING',
      notes: body.notes ?? null,
    })
    .returning()

  await db.insert(auditLogs).values({
    actor_id: agentId,
    actor_name: (session.user as any).name ?? '',
    action: 'CREATE',
    entity_type: 'reconciliation',
    entity_id: record.id,
    after_data: JSON.stringify({ date, cash_collected: cashCollected, cash_submitted: cashSubmitted }),
  })

  return NextResponse.json(record, { status: 201 })
}
