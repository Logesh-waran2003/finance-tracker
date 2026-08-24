import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { expenses, expenseCategories } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { ExpensesClient } from '@/components/expenses/expenses-client'
import type { Session } from 'next-auth'

export default async function ExpensesPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const [initial, categories] = await Promise.all([
    db.select({
      id: expenses.id,
      category_name: expenseCategories.name,
      amount: expenses.amount,
      payment_mode: expenses.payment_mode,
      description: expenses.description,
      expense_date: expenses.expense_date,
      status: expenses.status,
      rejection_reason: expenses.rejection_reason,
    }).from(expenses)
      .leftJoin(expenseCategories, eq(expenses.category_id, expenseCategories.id))
      .where(eq(expenses.employee_id, session.user.id))
      .orderBy(desc(expenses.expense_date))
      .limit(50),

    db.select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .where(eq(expenseCategories.is_active, true)),
  ])

  return (
    <ExpensesClient
      initial={initial.map(r => ({ ...r, amount: String(r.amount) }))}
      categories={categories}
    />
  )
}
