import { auth } from '@/auth'
import { db } from '@/lib/db'
import { dues, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, notInArray, desc } from 'drizzle-orm'
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
  const agent_id = url.searchParams.get('agent_id')

  const conditions: any[] = [notInArray(dues.status, ['PAID', 'CANCELLED'])]
  if (agent_id) conditions.push(eq(customers.assigned_agent_id, agent_id))

  const rows = await db.select({
    customer_name: customers.full_name,
    customer_code: customers.customer_code,
    agent_name: profiles.full_name,
    invoice_number: dues.invoice_number,
    amount: dues.amount,
    outstanding_amount: dues.outstanding_amount,
    due_date: dues.due_date,
    status: dues.status,
    notes: dues.notes,
  }).from(dues)
    .leftJoin(customers, eq(dues.customer_id, customers.id))
    .leftJoin(profiles, eq(customers.assigned_agent_id, profiles.id))
    .where(and(...conditions))
    .orderBy(desc(dues.due_date))

  const headers = ['Customer', 'Code', 'Agent', 'Invoice', 'Amount', 'Outstanding', 'Due Date', 'Status', 'Notes']
  const data = rows.map(r => [
    r.customer_name ?? '',
    r.customer_code ?? '',
    r.agent_name ?? '',
    r.invoice_number ?? '',
    r.amount,
    r.outstanding_amount,
    r.due_date ?? '',
    r.status,
    r.notes ?? '',
  ])

  const body = csv([headers, ...data])
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="outstanding-dues.csv"`,
    },
  })
}
