import { db } from '@/lib/db'
import { dues, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, notInArray, desc, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { buildCsv } from '@/lib/utils/csv'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const agent_id = url.searchParams.get('agent_id')

  const conditions: ReturnType<typeof eq>[] = [
    notInArray(dues.status, ['PAID', 'CANCELLED']) as any,
    isNull(dues.deleted_at) as any,
  ]

  if (agent_id) conditions.push(eq(customers.assigned_agent_id, agent_id) as any)

  // Branch isolation — dues are scoped via customer's branch_id
  if (actor.branch_id) {
    conditions.push(eq(customers.branch_id, actor.branch_id) as any)
  }

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
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
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

  const body = buildCsv(headers, data)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="outstanding-dues.csv"',
    },
  })
}
