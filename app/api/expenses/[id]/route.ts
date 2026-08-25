import { auth } from '@/auth'
import { db } from '@/lib/db'
import { expenses, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { withErrorHandler } from '@/lib/auth/authorize'

// Soft-delete: set status to CANCELLED instead of hard-deleting financial records
export const DELETE = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const expense = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.employee_id, session.user.id)))
    .limit(1)
    .then(r => r[0])

  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (expense.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only PENDING expenses can be deleted' }, { status: 400 })
  }

  // Soft-delete via status — never hard-delete financial records
  await db
    .update(expenses)
    .set({ status: 'REJECTED', rejection_reason: 'Deleted by employee', updated_at: new Date() })
    .where(eq(expenses.id, id))

  await db.insert(auditLogs).values({
    actor_id: session.user.id,
    actor_name: session.user.name ?? '',
    action: 'DELETE',
    entity_type: 'expense',
    entity_id: id,
    before_data: { status: expense.status, amount: expense.amount },
    after_data: { status: 'REJECTED', rejection_reason: 'Deleted by employee' },
  })

  return NextResponse.json({ success: true })
})
