import { db } from '@/lib/db'
import { expenses, expenseCategories, profiles } from '@/lib/db/schema'
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
    isNull(expenses.deleted_at) as any,
  ]

  // Branch isolation
  if (actor.branch_id) {
    conditions.push(eq(expenses.branch_id, actor.branch_id) as any)
  }

  if (from) conditions.push(gte(expenses.expense_date, from) as any)
  if (to) conditions.push(lte(expenses.expense_date, to) as any)
  if (agent_id) conditions.push(eq(expenses.employee_id, agent_id) as any)
  if (status) conditions.push(eq(expenses.status, status as any) as any)

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
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
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

  const body = buildCsv(headers, data)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="expenses-report.csv"',
    },
  })
}
