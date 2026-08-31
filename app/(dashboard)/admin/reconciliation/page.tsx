import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { reconciliations, profiles } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { AdminReconciliationClient } from '@/components/reconciliation/admin-reconciliation-client'

export default async function AdminReconciliationPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/dashboard')

  const [initial, agents] = await Promise.all([
    db.select({
      id: reconciliations.id,
      agent_id: reconciliations.agent_id,
      agent_name: profiles.full_name,
      date: reconciliations.date,
      cash_collected: reconciliations.cash_collected,
      cash_submitted: reconciliations.cash_submitted,
      difference: reconciliations.difference,
      status: reconciliations.status,
      notes: reconciliations.notes,
      verified_at: reconciliations.verified_at,
      rejection_reason: reconciliations.rejection_reason,
      created_at: reconciliations.created_at,
    }).from(reconciliations)
      .leftJoin(profiles, eq(reconciliations.agent_id, profiles.id))
      .orderBy(desc(reconciliations.date))
      .limit(200),

    db.select({ id: profiles.id, full_name: profiles.full_name })
      .from(profiles)
      .where(and(eq(profiles.role, 'COLLECTION_AGENT'), eq(profiles.is_active, true))),
  ])

  return (
    <AdminReconciliationClient
      initial={initial.map(r => ({
        ...r,
        cash_collected: String(r.cash_collected),
        cash_submitted: String(r.cash_submitted),
        difference: r.difference ? String(r.difference) : null,
        verified_at: r.verified_at?.toISOString() ?? null,
        created_at: r.created_at?.toISOString() ?? null,
      }))}
      agents={agents}
    />
  )
}
