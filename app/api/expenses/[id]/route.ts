import { auth } from '@/auth'
import { db } from '@/lib/db'
import { expenses, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const expense = await db.select().from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.employee_id, session.user.id)))
    .limit(1).then(r => r[0])

  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (expense.status !== 'PENDING') return NextResponse.json({ error: 'Only PENDING expenses can be deleted' }, { status: 400 })

  await db.delete(expenses).where(eq(expenses.id, id))

  return NextResponse.json({ success: true })
}
