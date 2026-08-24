import { auth } from '@/auth'
import { db } from '@/lib/db'
import { collections, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import type { Session } from 'next-auth'

function csv(rows: string[][]): string {
  return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

function fmtDate(d: Date | null) {
  if (!d) return ''
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  if (from) conditions.push(gte(collections.collected_at, new Date(from + 'T00:00:00+05:30')))
  if (to) conditions.push(lte(collections.collected_at, new Date(to + 'T23:59:59+05:30')))
  if (agent_id) conditions.push(eq(collections.agent_id, agent_id))
  if (status) conditions.push(eq(collections.status, status as any))

  const agentProfiles = profiles

  const rows = await db.select({
    collection_number: collections.collection_number,
    customer_name: customers.full_name,
    customer_code: customers.customer_code,
    agent_name: agentProfiles.full_name,
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
    .leftJoin(agentProfiles, eq(collections.agent_id, agentProfiles.id))
    .where(conditions.length ? and(...conditions) : undefined)
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

  const body = csv([headers, ...data])
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="collections-report.csv"`,
    },
  })
}
