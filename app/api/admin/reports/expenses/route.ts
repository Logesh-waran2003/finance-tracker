import { auth } from '@/auth'
import { db } from '@/lib/db'
import { expenses, expenseCategories, profiles } from '@/lib/db/schema'
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
  if (from) conditions.push(gte(expenses.expense_date, from))
  if (to) conditions.push(lte(expenses.expense_date, to))
  if (agent_id) conditions.push(eq(expenses.employee_id, agent_id))
  if (status) conditions.push(eq(expenses.status, status as any))

  const rows = await db.select({
    employee_name: profiles.full_name,
    category: expenseCategories.name,
    description: expenses.description,
    amount: expenses.amount,
    payment_mode: expenses.payment_mode,
    expense_date: expenses.expense_date,
    status: expenses.status,
    rejection_reason: expenses.rejection_reason,
    approved_at: expenses.approved_at,
  }).from(expenses)
    .leftJoin(profiles, eq(expenses.employee_id, profiles.id))
    .leftJoin(expenseCategories, eq(expenses.category_id, expenseCategories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.expense_date))

  const headers = ['Employee', 'Category', 'Description', 'Amount', 'Payment Mode', 'Date', 'Status', 'Rejection Reason', 'Approved At']
  const data = rows.map(r => [
    r.employee_name ?? '',
    r.category ?? '',
    r.description,
    r.amount,
    r.payment_mode,
    r.expense_date,
    r.status,
    r.rejection_reason ?? '',
    r.approved_at ? r.approved_at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
  ])

  const body = csv([headers, ...data])
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-report.csv"`,
    },
  })
}
