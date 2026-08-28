/**
 * Loan payment service — collect installments, reverse payments, waive penalties.
 * No NextRequest/Response — auth stays in the route layer.
 */
import { loanPayments, loanSchedules, paymentReversals, loanPenalties } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
import { writeLedgerEntry } from '@/lib/modules/ledger/service'
import { ServiceError } from '@/lib/modules/errors'
import { updateLoanBalances } from '@/lib/modules/loans/service'

// Accepts both db and a tx from db.transaction()
type AnyDB = {
  insert: (...a: any[]) => any
  select: (...a: any[]) => any
  update: (...a: any[]) => any
  delete: (...a: any[]) => any
  execute: (...a: any[]) => any
  transaction: (...a: any[]) => any
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Convert decimal string/number to integer cents */
const toCents = (v: string | number): number =>
  Math.round(parseFloat(String(v)) * 100)

/** Convert integer cents to 2dp decimal string */
const fromCents = (c: number): string => (c / 100).toFixed(2)

/** Today's date string (YYYY-MM-DD) in Asia/Kolkata timezone */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  )
}

// ── types ─────────────────────────────────────────────────────────────────────

export type CollectInstallmentParams = {
  loanId: string
  agentId: string
  actorName: string
  actorEmail: string
  branchId: string | null
  isAdmin?: boolean
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'
  paymentReference?: string
  transactionReference?: string
}

export type LoanPaymentRecord = typeof loanPayments.$inferSelect

export type ReversePaymentParams = {
  loanPaymentId: string
  reason: string
  reversedBy: string
  actorName: string
  actorEmail: string
  branchId: string | null
}

export type WaivePenaltyParams = {
  penaltyId: string
  waivedAmount: number
  reason: string
  waivedBy: string
  actorName: string
  actorEmail: string
  branchId: string | null
}

// ── collectInstallment ────────────────────────────────────────────────────────

/**
 * Collects today's installment for a loan. Enforces agent assignment,
 * duplicate-payment guard, and idempotency via transactionReference.
 * All steps run inside one transaction with a row-level lock on the loan.
 */
export async function collectInstallment(
  db: AnyDB,
  params: CollectInstallmentParams,
): Promise<LoanPaymentRecord> {
  return (db as any).transaction(async (tx: AnyDB) => {
    // Row-lock the loan to prevent concurrent double-collection
    const [loan] = await (tx as any).execute(
      sql`SELECT * FROM loans WHERE id = ${params.loanId} FOR UPDATE`,
    ) as any[]

    if (!loan) throw new ServiceError('Loan not found', 404)

    // Agent must be authenticated; any agent can collect any active loan
    if (loan.status === 'COMPLETED') {
      throw new ServiceError('Loan is already completed', 400)
    }
    if (loan.status === 'CANCELLED') {
      throw new ServiceError('Loan is cancelled', 400)
    }
    if (toCents(loan.principal_outstanding) <= 0) {
      throw new ServiceError('No outstanding principal on this loan', 400)
    }

    const today = todayIST()

    // Lock today's schedule row
    const [schedule] = await (tx as any).execute(
      sql`
        SELECT * FROM loan_schedules
        WHERE loan_id = ${params.loanId}
          AND scheduled_date = ${today}
          AND status = 'PENDING'
        FOR UPDATE
        LIMIT 1
      `,
    ) as any[]

    if (!schedule) {
      throw new ServiceError('No pending schedule for today', 400)
    }

    // Idempotency — return existing payment if transactionReference already used
    if (params.transactionReference) {
      const [existing] = await (tx as any).execute(
        sql`
          SELECT * FROM loan_payments
          WHERE transaction_reference = ${params.transactionReference}
          LIMIT 1
        `,
      ) as any[]
      if (existing) return existing as LoanPaymentRecord
    }

    // Duplicate guard — no non-reversed payment for this schedule
    const [duplicate] = await (tx as any).execute(
      sql`
        SELECT id FROM loan_payments
        WHERE loan_schedule_id = ${schedule.id}
          AND is_reversed = false
        LIMIT 1
      `,
    ) as any[]
    if (duplicate) {
      throw new ServiceError('A payment for this schedule already exists', 400)
    }

    // Final installment safety: never collect more than principal outstanding
    const scheduledCents = toCents(schedule.installment_amount)
    const outstandingCents = toCents(loan.principal_outstanding)
    const amountCents = Math.min(scheduledCents, outstandingCents)

    // Generate payment_number
    const [lastPay] = await (tx as any).execute(
      sql`SELECT payment_number FROM loan_payments ORDER BY payment_number DESC LIMIT 1`,
    ) as any[]
    const nextNum = lastPay?.payment_number
      ? parseInt(lastPay.payment_number.split('-')[1], 10) + 1
      : 1001
    const paymentNumber = 'PAY-' + String(nextNum).padStart(6, '0')

    const [payment] = await (tx as any)
      .insert(loanPayments)
      .values({
        payment_number: paymentNumber,
        loan_id: params.loanId,
        loan_schedule_id: schedule.id,
        customer_id: loan.customer_id,
        agent_id: params.agentId,
        branch_id: params.branchId,
        scheduled_date: schedule.scheduled_date,
        payment_date: todayIST(),
        amount: fromCents(amountCents),
        payment_type: 'PRINCIPAL',
        payment_mode: params.paymentMode,
        payment_reference: params.paymentReference ?? null,
        transaction_reference: params.transactionReference ?? null,
        status: 'CONFIRMED',
        is_reversed: false,
        collected_at: new Date(),
      })
      .returning()

    // Mark schedule PAID
    await (tx as any).execute(
      sql`
        UPDATE loan_schedules
        SET status = 'PAID', paid_at = NOW(), updated_at = NOW()
        WHERE id = ${schedule.id}
      `,
    )

    // Recalculate loan balances (handles COMPLETED detection)
    await updateLoanBalances(tx, params.loanId)

    // Ledger entry — 'collection' is the closest existing entity_type
    await writeLedgerEntry(tx, {
      entity_type: 'collection',
      entity_id: payment.id,
      entry_type: 'CREDIT',
      amount: fromCents(amountCents),
      actor_id: params.agentId,
      branch_id: params.branchId,
      notes: `Loan installment — ${loan.loan_number}`,
    })

    await logAudit(tx, {
      actor_id: params.agentId,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: 'PAYMENT_COLLECTED',
      entity_type: 'loan_payment',
      entity_id: payment.id,
      after_data: {
        payment_number: payment.payment_number,
        loan_id: params.loanId,
        amount: fromCents(amountCents),
        scheduled_date: today,
        payment_mode: params.paymentMode,
      },
      branch_id: params.branchId,
    })

    return payment as LoanPaymentRecord
  })
}

// ── reversePayment ────────────────────────────────────────────────────────────

/**
 * Reverses a previously collected loan payment. Reopens the schedule
 * so it can be re-collected or caught by the missed-payment cron.
 */
export async function reversePayment(
  db: AnyDB,
  params: ReversePaymentParams,
): Promise<void> {
  return (db as any).transaction(async (tx: AnyDB) => {
    const [payment] = await (tx as any).execute(
      sql`SELECT * FROM loan_payments WHERE id = ${params.loanPaymentId} FOR UPDATE`,
    ) as any[]

    if (!payment) throw new ServiceError('Payment not found', 404)
    if (payment.is_reversed) {
      throw new ServiceError('Payment has already been reversed', 400)
    }

    // Mark payment reversed
    await (tx as any).execute(
      sql`
        UPDATE loan_payments
        SET
          is_reversed     = true,
          reversed_by     = ${params.reversedBy},
          reversed_at     = NOW(),
          reversal_reason = ${params.reason},
          updated_at      = NOW()
        WHERE id = ${params.loanPaymentId}
      `,
    )

    // Reopen the schedule so it can be re-collected or missed
    if (payment.loan_schedule_id) {
      await (tx as any).execute(
        sql`
          UPDATE loan_schedules
          SET status = 'PENDING', paid_at = NULL, updated_at = NOW()
          WHERE id = ${payment.loan_schedule_id}
        `,
      )
    }

    // Record in payment_reversals
    await (tx as any).insert(paymentReversals).values({
      loan_payment_id: params.loanPaymentId,
      loan_id: payment.loan_id,
      reversed_by: params.reversedBy,
      reason: params.reason,
      amount: payment.amount,
      reversed_at: new Date(),
    })

    // Ledger reversal entry
    await writeLedgerEntry(tx, {
      entity_type: 'collection',
      entity_id: params.loanPaymentId,
      entry_type: 'REVERSAL',
      amount: payment.amount,
      actor_id: params.reversedBy,
      branch_id: params.branchId,
      notes: `Reversal — ${params.reason}`,
    })

    await updateLoanBalances(tx, payment.loan_id)

    await logAudit(tx, {
      actor_id: params.reversedBy,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: 'PAYMENT_REVERSED',
      entity_type: 'loan_payment',
      entity_id: params.loanPaymentId,
      after_data: {
        loan_id: payment.loan_id,
        amount: payment.amount,
        reason: params.reason,
      },
      branch_id: params.branchId,
    })
  })
}

// ── waivePenalty ──────────────────────────────────────────────────────────────

/**
 * Waives part or all of a penalty. Updates loan balances after.
 */
export async function waivePenalty(
  db: AnyDB,
  params: WaivePenaltyParams,
): Promise<void> {
  return (db as any).transaction(async (tx: AnyDB) => {
    const [penalty] = await (tx as any).execute(
      sql`SELECT * FROM loan_penalties WHERE id = ${params.penaltyId} FOR UPDATE`,
    ) as any[]

    if (!penalty) throw new ServiceError('Penalty not found', 404)
    if (penalty.is_waived) {
      throw new ServiceError('Penalty has already been fully waived', 400)
    }

    const penaltyCents = toCents(penalty.penalty_amount)
    const waivedCents = toCents(params.waivedAmount)

    if (waivedCents <= 0) {
      throw new ServiceError('waivedAmount must be greater than 0', 400)
    }
    if (waivedCents > penaltyCents) {
      throw new ServiceError(
        `waivedAmount (${params.waivedAmount}) exceeds penalty_amount (${penalty.penalty_amount})`,
        400,
      )
    }

    const isFullWaiver = waivedCents === penaltyCents

    await (tx as any).execute(
      sql`
        UPDATE loan_penalties
        SET
          is_waived      = ${isFullWaiver},
          waived_amount  = ${fromCents(waivedCents)},
          waived_by      = ${params.waivedBy},
          waived_at      = NOW(),
          waiver_reason  = ${params.reason},
          updated_at     = NOW()
        WHERE id = ${params.penaltyId}
      `,
    )

    await updateLoanBalances(tx, penalty.loan_id)

    await logAudit(tx, {
      actor_id: params.waivedBy,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: 'PENALTY_WAIVED',
      entity_type: 'loan_penalty',
      entity_id: params.penaltyId,
      after_data: {
        loan_id: penalty.loan_id,
        penalty_amount: penalty.penalty_amount,
        waived_amount: fromCents(waivedCents),
        is_full_waiver: isFullWaiver,
        reason: params.reason,
      },
      branch_id: params.branchId,
    })
  })
}
