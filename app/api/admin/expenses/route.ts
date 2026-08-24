import { auth } from '@/auth'
import { db } from '@/lib/db'
import { expenses, expenseCategories, profiles, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import type { Session } from 'next-auth'

function getAdmin(s: Session | null) {
  if (!s?.user?.id || (s.user as any).role !== 'ADMIN') return null
  return s.user
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const employee_id = url.searchParams.get('employee_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  const conditions: any[] = []
  if (status) conditions.push(eq(expenses.status, status as any))
  if (employee_id) conditions.push(eq(expenses.employee_id, employee_id))
  if (start) conditions.push(gte(expenses.expense_date, start))
  if (end) conditions.push(lte(expenses.expense_date, end))

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
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.expense_date))
    .limit(200)

  return NextResponse.json(rows)
}
