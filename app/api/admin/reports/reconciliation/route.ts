import { auth } from '@/auth'
import { db } from '@/lib/db'
import { reconciliations, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import type { Session } from 'next-auth'

function csv(rows: string[][]): string {
  return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const agent_id = url.searchParams.get('agent_id')
  const status = url.searchParams.get('status')

  const conditions: any[] = []
  if (from) conditions.push(gte(reconciliations.date, from))
  if (to) conditions.push(lte(reconciliations.date, to))
  if (agent_id) conditions.push(eq(reconciliations.agent_id, agent_id))
  if (status) conditions.push(eq(reconciliations.status, status as any))

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
    .where(conditions.length ? and(...conditions) : undefined)
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

  const body = csv([headers, ...data])
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="reconciliation-report.csv"`,
    },
  })
}
