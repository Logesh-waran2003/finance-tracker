import { db } from '@/lib/db'
import { expenses, expenseCategories, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const employee_id = url.searchParams.get('employee_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  const conditions: ReturnType<typeof eq>[] = [
    isNull(expenses.deleted_at) as any,
  ]

  // Branch isolation
  if (actor.branch_id) {
    conditions.push(eq(expenses.branch_id, actor.branch_id) as any)
  }

  if (status) conditions.push(eq(expenses.status, status as any) as any)
  if (employee_id) conditions.push(eq(expenses.employee_id, employee_id) as any)
  if (start) conditions.push(gte(expenses.expense_date, start) as any)
  if (end) conditions.push(lte(expenses.expense_date, end) as any)

  const rows = await db.select({
    id: expenses.id,
    employee_id: expenses.employee_id,
    employee_name: profiles.full_name,
    category_name: expenseCategories.name,
    amount: expenses.amount,
    payment_mode: expenses.payment_mode,
    description: expenses.description,
    expense_date: expenses.expense_date,
    status: expenses.status,
    rejection_reason: expenses.rejection_reason,
    approved_at: expenses.approved_at,
    created_at: expenses.created_at,
  }).from(expenses)
    .leftJoin(profiles, eq(expenses.employee_id, profiles.id))
    .leftJoin(expenseCategories, eq(expenses.category_id, expenseCategories.id))
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(desc(expenses.expense_date))
    .limit(200)

  return NextResponse.json(rows)
}
