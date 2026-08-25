/**
 * Reconciliation service — business logic for daily cash handover.
 * Key invariant: cash_collected is ALWAYS calculated server-side from confirmed
 * CASH collections. Client-supplied totals are never trusted.
 */
import { reconciliations, collections } from '@/lib/db/schema'
import { eq, and, sum, sql } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
import { writeLedgerEntry } from '@/lib/modules/ledger/service'
import { ServiceError } from '@/lib/modules/errors'

 
type AnyDB = { insert: (...a: any[]) => any; select: (...a: any[]) => any; update: (...a: any[]) => any; transaction: (...a: any[]) => any }

export type CreateReconciliationParams = {
  agentId: string
  branchId: string | null
  actorName: string
  actorEmail: string
  date: string        // YYYY-MM-DD
  cashSubmitted: number
  notes?: string
}

export type VerifyReconciliationParams = {
  reconciliationId: string
  adminId: string
  adminBranchId: string | null
  actorName: string
  actorEmail: string
  action: 'VERIFIED' | 'REJECTED'
  notes?: string
}

/**
 * Submits a daily reconciliation.
 *
 * - Rejects future dates
 * - Calculates cash_collected server-side (CONFIRMED + CASH + agent + date)
 * - Enforces one-per-agent-per-date via DB unique constraint (uq_reconciliations_agent_date)
 */
export async function createReconciliation(
  db: AnyDB,
  params: CreateReconciliationParams,
): Promise<typeof reconciliations.$inferSelect> {
  const today = new Date().toISOString().split('T')[0]
  if (params.date > today) {
    throw new ServiceError('date cannot be in the future', 400)
  }

  // Server-side cash total — never use client-supplied value
  const [cashRow] = await (db as any)
    .select({ total: sum(collections.amount) })
    .from(collections)
    .where(
      and(
        eq(collections.agent_id, params.agentId),
        eq(collections.payment_mode, 'CASH'),
        eq(collections.status, 'CONFIRMED'),
        sql`DATE(${collections.collected_at} AT TIME ZONE 'Asia/Kolkata') = ${params.date}::date`,
      ),
    )
  const cashCollected = parseFloat((cashRow as any)?.total ?? '0')

  return (db as any).transaction(async (tx: AnyDB) => {
    try {
      const [record] = await (tx as any)
        .insert(reconciliations)
        .values({
          agent_id: params.agentId,
          branch_id: params.branchId,
          date: params.date,
          cash_collected: String(cashCollected),
          cash_submitted: String(params.cashSubmitted),
          status: 'PENDING',
          notes: params.notes ?? null,
        })
        .returning()

      await logAudit(tx, {
        actor_id: params.agentId,
        actor_name: params.actorName,
        actor_email: params.actorEmail,
        action: 'CREATE',
        entity_type: 'reconciliation',
        entity_id: record.id,
        after_data: {
          date: params.date,
          cash_collected: cashCollected,
          cash_submitted: params.cashSubmitted,
        },
        branch_id: params.branchId,
      })

      return record
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ServiceError('Reconciliation already submitted for this date', 409)
      }
      throw err
    }
  })
}

/**
 * Verifies or rejects a PENDING/SUBMITTED reconciliation.
 * Verification writes a RECONCILIATION ledger entry.
 */
export async function verifyReconciliation(
  db: AnyDB,
  params: VerifyReconciliationParams,
): Promise<typeof reconciliations.$inferSelect> {
  const recon = await (db as any)
    .select()
    .from(reconciliations)
    .where(eq(reconciliations.id, params.reconciliationId))
    .limit(1)
    .then((r: any[]) => r[0])

  if (!recon) throw new ServiceError('Reconciliation not found', 404)

  // Branch isolation: admin must only action reconciliations from their own branch
  if (params.adminBranchId && recon.branch_id !== params.adminBranchId) {
    throw new ServiceError('Reconciliation not found', 404)
  }

  if (recon.status !== 'PENDING' && recon.status !== 'SUBMITTED') {
    throw new ServiceError('Only PENDING or SUBMITTED reconciliations can be actioned', 400)
  }

  const now = new Date()
  const isVerification = params.action === 'VERIFIED'
  const updates: Record<string, unknown> = { updated_at: now }

  if (isVerification) {
    updates.status = 'VERIFIED'
    updates.verified_by = params.adminId
    updates.verified_at = now
  } else {
    updates.status = 'REJECTED'
    updates.rejection_reason = params.notes
  }

  return (db as any).transaction(async (tx: AnyDB) => {
    const [updated] = await (tx as any)
      .update(reconciliations)
      .set(updates)
      .where(eq(reconciliations.id, params.reconciliationId))
      .returning()

    await logAudit(tx, {
      actor_id: params.adminId,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: isVerification ? 'VERIFY' : 'REJECT',
      entity_type: 'reconciliation',
      entity_id: params.reconciliationId,
      before_data: { status: recon.status },
      after_data: { status: updated.status },
      branch_id: params.adminBranchId,
    })

    if (isVerification) {
      await writeLedgerEntry(tx, {
        entity_type: 'reconciliation',
        entity_id: params.reconciliationId,
        entry_type: 'RECONCILIATION',
        amount: recon.cash_submitted,
        actor_id: params.adminId,
        branch_id: recon.branch_id,
        notes: `Cash handover verified for ${recon.date}`,
      })
    }

    return updated
  })
}
