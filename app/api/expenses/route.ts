import { db } from '@/lib/db'
import { expenses, expenseCategories } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { requireRole, isResponse } from '@/lib/auth/authorize'
import { parseBody, createExpenseSchema } from '@/lib/validation'
import { createExpense } from '@/lib/modules/expenses/service'
import { ServiceError } from '@/lib/modules/errors'

export async function GET(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  const conditions: any[] = [eq(expenses.employee_id, actor.id)]
  if (status) conditions.push(eq(expenses.status, status as any))

  const rows = await db
    .select({
      id: expenses.id,
      category_id: expenses.category_id,
      category_name: expenseCategories.name,
      amount: expenses.amount,
      payment_mode: expenses.payment_mode,
      description: expenses.description,
      expense_date: expenses.expense_date,
      status: expenses.status,
      rejection_reason: expenses.rejection_reason,
      created_at: expenses.created_at,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.category_id, expenseCategories.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.expense_date))
    .limit(50)

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, createExpenseSchema)
  if (!parsed.ok) return parsed.response

  const { category_id, amount, payment_mode, description, expense_date } = parsed.data

  try {
    const expense = await createExpense(db, {
      userId: actor.id,
      branchId: actor.branch_id,
      actorName: actor.name,
      actorEmail: actor.email,
      categoryId: category_id,
      amount,
      paymentMode: payment_mode,
      description,
      expenseDate: expense_date,
    })
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
