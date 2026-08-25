import { db } from '@/lib/db'
import { reconciliations, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { reportDateRangeSchema } from '@/lib/validation'
import { buildCsv } from '@/lib/utils/csv'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined
  const agent_id = url.searchParams.get('agent_id')
  const status = url.searchParams.get('status')

  // Date range validation — max 1 year
  const rangeCheck = reportDateRangeSchema.safeParse({ from, to })
  if (!rangeCheck.success) {
    const msg = rangeCheck.error.issues[0]?.message ?? 'Invalid date range'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const conditions: ReturnType<typeof eq>[] = [
    isNull(reconciliations.deleted_at) as any,
  ]

  // Branch isolation
  if (actor.branch_id) {
    conditions.push(eq(reconciliations.branch_id, actor.branch_id) as any)
  }

  if (from) conditions.push(gte(reconciliations.date, from) as any)
  if (to) conditions.push(lte(reconciliations.date, to) as any)
  if (agent_id) conditions.push(eq(reconciliations.agent_id, agent_id) as any)
  if (status) conditions.push(eq(reconciliations.status, status as any) as any)

  const rows = await db.select({
    agent_name: profiles.full_name,
    date: reconciliations.date,
    cash_collected: reconciliations.cash_collected,
    cash_submitted: reconciliations.cash_submitted,
    difference: reconciliations.difference,
    status: reconciliations.status,
    notes: reconciliations.notes,
    verified_at: reconciliations.verified_at,
    rejection_reason: reconciliations.rejection_reason,
  }).from(reconciliations)
    .leftJoin(profiles, eq(reconciliations.agent_id, profiles.id))
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(desc(reconciliations.date))

  const headers = ['Agent', 'Date', 'Cash Collected', 'Cash Submitted', 'Difference', 'Status', 'Notes', 'Verified At', 'Rejection Reason']
  const data = rows.map(r => [
    r.agent_name ?? '',
    r.date,
    r.cash_collected,
    r.cash_submitted,
    r.difference ?? '0',
    r.status,
    r.notes ?? '',
    r.verified_at ? r.verified_at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    r.rejection_reason ?? '',
  ])

  const body = buildCsv(headers, data)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reconciliation-report.csv"',
    },
  })
}
