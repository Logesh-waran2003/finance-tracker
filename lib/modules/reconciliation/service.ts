/**
 * Reconciliation service — business logic for daily cash handover.
 * Key invariant: cash_collected is ALWAYS calculated server-side from confirmed
 * CASH collections. Client-supplied totals are never trusted.
 */
import { reconciliations, collections, profiles, notifications, loanPayments } from '@/lib/db/schema'
import { eq, and, sum, sql } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
import { writeLedgerEntry } from '@/lib/modules/ledger/service'
import { ServiceError } from '@/lib/modules/errors'

 
type AnyDB = { insert: (...a: any[]) => any; select: (...a: any[]) => any; update: (...a: any[]) => any; transaction: (...a: any[]) => any; execute: (...a: any[]) => any }

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
 * - Calculates cash_collected server-side (CONFIRMED + CASH + agent + date) including loan payments
 * - Enforces one-per-agent-per-date via DB unique constraint (uq_reconciliations_agent_date)
 * - Notifies all branch admins on submit
 */
export async function createReconciliation(
  db: AnyDB,
  params: CreateReconciliationParams,
): Promise<typeof reconciliations.$inferSelect> {
  const today = new Date().toISOString().split('T')[0]
  if (params.date > today) {
    throw new ServiceError('date cannot be in the future', 400)
  }

  // Server-side cash total from freeform collections
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

  // Server-side cash total from loan installment payments
  const [loanCashRow] = await (db as any)
    .select({ total: sum(loanPayments.amount) })
    .from(loanPayments)
    .where(
      and(
        eq(loanPayments.agent_id, params.agentId),
        eq(loanPayments.payment_mode, 'CASH'),
        eq(loanPayments.is_reversed, false),
        sql`DATE(${loanPayments.created_at} AT TIME ZONE 'Asia/Kolkata') = ${params.date}::date`,
      ),
    )

  const cashCollected =
    parseFloat((cashRow as any)?.total ?? '0') +
    parseFloat((loanCashRow as any)?.total ?? '0')

  if (params.cashSubmitted > cashCollected + 0.01) {
    throw new ServiceError(
      `Cannot submit ₹${params.cashSubmitted} — only ₹${cashCollected.toFixed(2)} collected in cash today`,
      400,
    )
  }

  const record = await (db as any).transaction(async (tx: AnyDB) => {
    try {
      // If a PENDING record already exists for this date, update it instead of inserting
      const existing = await (tx as any)
        .select({ id: reconciliations.id, status: reconciliations.status })
        .from(reconciliations)
        .where(and(eq(reconciliations.agent_id, params.agentId), eq(reconciliations.date, params.date)))
        .limit(1)
        .then((r: any[]) => r[0])

      if (existing) {
        if (existing.status !== 'PENDING') {
          throw new ServiceError('Reconciliation already submitted and cannot be changed', 409)
        }
        // Update the existing PENDING record
        const [rec] = await (tx as any)
          .update(reconciliations)
          .set({
            cash_collected: String(cashCollected),
            cash_submitted: String(params.cashSubmitted),
            notes: params.notes ?? null,
            updated_at: new Date(),
          })
          .where(eq(reconciliations.id, existing.id))
          .returning()
        return rec
      }
      const [rec] = await (tx as any)
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
        entity_id: rec.id,
        after_data: {
          date: params.date,
          cash_collected: cashCollected,
          cash_submitted: params.cashSubmitted,
        },
        branch_id: params.branchId,
      })

      return rec
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ServiceError('Reconciliation already submitted for this date', 409)
      }
      throw err
    }
  })

  // Fire-and-forget: notify all admins in branch
  const adminWhere = params.branchId
    ? and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true), eq(profiles.branch_id, params.branchId))
    : and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true));

  (db as any).select({ id: profiles.id })
    .from(profiles)
    .where(adminWhere)
    .then((admins: any[]) => {
      if (!admins.length) return
      return (db as any).insert(notifications).values(
        admins.map((a: any) => ({
          recipient_id: a.id,
          type: 'GENERAL',
          title: 'Cash Handover Submitted',
          body: `${params.actorName} submitted ₹${params.cashSubmitted.toLocaleString('en-IN')} cash handover for ${params.date}`,
          reference_id: record.id,
          reference_type: 'reconciliation',
        }))
      )
    })
    .catch(() => {})

  return record
}

/**
 * Verifies or rejects a PENDING/SUBMITTED reconciliation.
 * Verification writes a RECONCILIATION ledger entry.
 * Notifies the agent on verify/reject.
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

  const updated = await (db as any).transaction(async (tx: AnyDB) => {
    const [upd] = await (tx as any)
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
      after_data: { status: upd.status },
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

    return upd
  })

  // Fire-and-forget: notify agent
  ;(db as any).insert(notifications).values({
    recipient_id: recon.agent_id,
    type: 'GENERAL',
    title: isVerification ? 'Cash Handover Verified' : 'Cash Handover Rejected',
    body: isVerification
      ? `Your ₹${parseFloat(recon.cash_submitted).toLocaleString('en-IN')} cash handover for ${recon.date} has been verified`
      : `Your cash handover for ${recon.date} was rejected${params.notes ? `: ${params.notes}` : ''}`,
    reference_id: params.reconciliationId,
    reference_type: 'reconciliation',
  }).catch(() => {})

  return updated
}
