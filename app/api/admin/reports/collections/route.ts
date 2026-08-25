import { db } from '@/lib/db'
import { collections, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { reportDateRangeSchema } from '@/lib/validation'
import { buildCsv } from '@/lib/utils/csv'

function fmtDate(d: Date | null) {
  if (!d) return ''
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

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
    isNull(collections.deleted_at) as any,
  ]

  // Branch isolation
  if (actor.branch_id) {
    conditions.push(eq(collections.branch_id, actor.branch_id) as any)
  }

  if (from) conditions.push(gte(collections.collected_at, new Date(from + 'T00:00:00+05:30')) as any)
  if (to) conditions.push(lte(collections.collected_at, new Date(to + 'T23:59:59+05:30')) as any)
  if (agent_id) conditions.push(eq(collections.agent_id, agent_id) as any)
  if (status) conditions.push(eq(collections.status, status as any) as any)

  const rows = await db.select({
    collection_number: collections.collection_number,
    customer_name: customers.full_name,
    customer_code: customers.customer_code,
    agent_name: profiles.full_name,
    amount: collections.amount,
    payment_mode: collections.payment_mode,
    payment_reference: collections.payment_reference,
    status: collections.status,
    collected_at: collections.collected_at,
    confirmed_at: collections.confirmed_at,
    rejected_reason: collections.rejected_reason,
    notes: collections.notes,
  }).from(collections)
    .leftJoin(customers, eq(collections.customer_id, customers.id))
    .leftJoin(profiles, eq(collections.agent_id, profiles.id))
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(desc(collections.collected_at))

  const headers = ['#', 'Customer', 'Code', 'Agent', 'Amount', 'Mode', 'Reference', 'Status', 'Collected At', 'Confirmed At', 'Rejection Reason', 'Notes']
  const data = rows.map(r => [
    r.collection_number ?? '',
    r.customer_name ?? '',
    r.customer_code ?? '',
    r.agent_name ?? '',
    r.amount,
    r.payment_mode,
    r.payment_reference ?? '',
    r.status,
    fmtDate(r.collected_at),
    fmtDate(r.confirmed_at),
    r.rejected_reason ?? '',
    r.notes ?? '',
  ])

  const body = buildCsv(headers, data)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="collections-report.csv"',
    },
  })
}
