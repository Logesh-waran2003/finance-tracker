import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { expenses, expenseCategories, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { AdminExpensesClient } from '@/components/expenses/admin-expenses-client'
import type { Session } from 'next-auth'

export default async function AdminExpensesPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const [initial, employees] = await Promise.all([
    db
      .select({
        id: expenses.id,
        employee_id: expenses.employee_id,
        employee_name: profiles.full_name,
        category_id: expenses.category_id,
        category_name: expenseCategories.name,
        amount: expenses.amount,
        payment_mode: expenses.payment_mode,
        description: expenses.description,
        expense_date: expenses.expense_date,
        status: expenses.status,
        approved_by: expenses.approved_by,
        approved_at: expenses.approved_at,
        rejection_reason: expenses.rejection_reason,
        created_at: expenses.created_at,
      })
      .from(expenses)
      .leftJoin(profiles, eq(expenses.employee_id, profiles.id))
      .leftJoin(expenseCategories, eq(expenses.category_id, expenseCategories.id))
      .orderBy(desc(expenses.expense_date))
      .limit(200),

    db
      .select({ id: profiles.id, full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.is_active, true)),
  ])

  return (
    <AdminExpensesClient
      initial={initial.map(r => ({
        ...r,
        amount: String(r.amount),
        approved_at: r.approved_at?.toISOString() ?? null,
        created_at: r.created_at?.toISOString() ?? null,
      }))}
      employees={employees}
    />
  )
}
