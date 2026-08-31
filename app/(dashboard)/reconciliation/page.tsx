import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { reconciliations } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { getCashCollectedCents, istToday } from '@/lib/modules/reconciliation/service'
import { ReconciliationClient } from '@/components/reconciliation/reconciliation-client'
import type { Session } from 'next-auth'

export default async function ReconciliationPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const role = session.user.role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') redirect('/dashboard')

  const userId = session.user.id
  const today = istToday()

  const [history, todaySubmittedRows] = await Promise.all([
    db.select().from(reconciliations)
      .where(eq(reconciliations.agent_id, userId))
      .orderBy(desc(reconciliations.date))
      .limit(30),

    // Today's submitted reconciliations (exclude REJECTED — those need resubmission)
    db.select({ total: sql<string>`coalesce(sum(${reconciliations.cash_submitted}), 0)` })
      .from(reconciliations)
      .where(and(
        eq(reconciliations.agent_id, userId),
        eq(reconciliations.date, today),
        sql`${reconciliations.status} != 'REJECTED'`,
      )),
  ])

  // One shared helper, so this screen can never disagree with the service that
  // actually writes cash_collected, or with GET /api/reconciliation.
  const todayCash = (await getCashCollectedCents(db, userId, today)) / 100
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
