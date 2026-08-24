import { auth } from '@/auth'
import { db } from '@/lib/db'
import { expenses, expenseCategories, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  const conditions: any[] = [eq(expenses.employee_id, session.user.id)]
  if (status) conditions.push(eq(expenses.status, status as any))

  const rows = await db.select({
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
  }).from(expenses)
    .leftJoin(expenseCategories, eq(expenses.category_id, expenseCategories.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.expense_date))
    .limit(50)

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { category_id, amount, payment_mode, description, expense_date } = body

  if (!category_id || !amount || !description || !expense_date) {
    return NextResponse.json({ error: 'category_id, amount, description, and expense_date are required' }, { status: 400 })
  }
  if (parseFloat(amount) <= 0) {
    return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 })
  }

  const profile = await db.select({ branch_id: (await import('@/lib/db/schema')).profiles.branch_id })
    .from((await import('@/lib/db/schema')).profiles)
    .where(eq((await import('@/lib/db/schema')).profiles.id, session.user.id))
    .limit(1).then(r => r[0])

  const [expense] = await db.insert(expenses).values({
    category_id,
    employee_id: session.user.id,
    branch_id: profile?.branch_id ?? null,
    amount: String(amount),
    payment_mode: payment_mode ?? 'CASH',
    description,
    expense_date,
    status: 'PENDING',
  }).returning()

  await db.insert(auditLogs).values({
    actor_id: session.user.id,
    actor_name: session.user.name ?? '',
    action: 'CREATE',
    entity_type: 'expense',
    entity_id: expense.id,
    after_data: JSON.stringify({ amount, description, expense_date }),
  })

  return NextResponse.json(expense, { status: 201 })
}
