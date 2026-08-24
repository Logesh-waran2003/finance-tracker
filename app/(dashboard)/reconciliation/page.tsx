import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { reconciliations, collections } from '@/lib/db/schema'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { ReconciliationClient } from '@/components/reconciliation/reconciliation-client'
import type { Session } from 'next-auth'

export default async function ReconciliationPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') redirect('/dashboard')

  const userId = session.user.id
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  const [history, todayCashRows, todaySubmittedRows] = await Promise.all([
    db.select().from(reconciliations)
      .where(eq(reconciliations.agent_id, userId))
      .orderBy(desc(reconciliations.date))
      .limit(30),

    // Today's CONFIRMED CASH collections
    db.select({ total: sql<string>`coalesce(sum(${collections.amount}), 0)` })
      .from(collections)
      .where(and(
        eq(collections.agent_id, userId),
        eq(collections.status, 'CONFIRMED'),
        eq(collections.payment_mode, 'CASH'),
        gte(collections.collected_at, new Date(today + 'T00:00:00+05:30')),
        lte(collections.collected_at, new Date(today + 'T23:59:59+05:30')),
      )),

    // Today's submitted reconciliations
    db.select({ total: sql<string>`coalesce(sum(${reconciliations.cash_submitted}), 0)` })
      .from(reconciliations)
      .where(and(
        eq(reconciliations.agent_id, userId),
        eq(reconciliations.date, today),
      )),
  ])

  const todayCash = parseFloat(todayCashRows[0]?.total ?? '0')
  const todaySubmitted = parseFloat(todaySubmittedRows[0]?.total ?? '0')

  return (
    <ReconciliationClient
      initial={history.map(r => ({
        ...r,
        cash_collected: String(r.cash_collected),
        cash_submitted: String(r.cash_submitted),
        difference: r.difference ? String(r.difference) : null,
        verified_at: r.verified_at?.toISOString() ?? null,
      }))}
      todayCash={todayCash}
      todaySubmitted={todaySubmitted}
    />
  )
}
