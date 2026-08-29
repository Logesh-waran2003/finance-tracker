/**
 * Loans service — core business logic for loan creation and balance tracking.
 * No NextRequest/Response — auth stays in the route layer.
 */
import {
  loans,
  loanSchedules,
  agentLoanAssignments,
  customers,
  profiles,
} from '@/lib/db/schema'
import { eq, desc, sql, and, inArray } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
import { ServiceError } from '@/lib/modules/errors'

// Accepts both db and a tx from db.transaction()
type AnyDB = {
  insert: (...a: any[]) => any
  select: (...a: any[]) => any
  update: (...a: any[]) => any
  delete: (...a: any[]) => any
  execute: (...a: any[]) => any
  transaction: (...a: any[]) => any
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Convert decimal string/number to integer cents, no float arithmetic */
const toCents = (v: string | number): number =>
  Math.round(parseFloat(String(v)) * 100)

/** Convert integer cents back to decimal string (2dp) */
const fromCents = (c: number): string => (c / 100).toFixed(2)

/** Add N calendar days to a YYYY-MM-DD string — pure date arithmetic, no libs */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── types ─────────────────────────────────────────────────────────────────────

export type CreateLoanParams = {
  actorId: string
  actorName: string
  actorEmail: string
  branchId: string | null
  customerId: string
  loanAmount: number
  interestPercentage: number
  dailyInstallment: number
  penaltyAmount: number
  disbursementDate: string // YYYY-MM-DD
  assignedAgentId: string | null
  notes?: string
}

export type LoanRecord = typeof loans.$inferSelect

export type LoanWithDetails = LoanRecord & {
  customer_name: string
  assigned_agent_name: string
}

// ── createLoan ────────────────────────────────────────────────────────────────

/**
 * Creates a loan, generates all daily repayment schedules, assigns an agent,
 * and writes an audit record — all inside one transaction.
 */
export async function createLoan(
  db: AnyDB,
  params: CreateLoanParams,
): Promise<LoanRecord> {
  // --- validation ---
  if (params.loanAmount <= 0) {
    throw new ServiceError('loanAmount must be greater than 0', 400)
  }
  if (params.interestPercentage < 0 || params.interestPercentage > 100) {
    throw new ServiceError('interestPercentage must be between 0 and 100', 400)
  }
  if (params.dailyInstallment <= 0) {
    throw new ServiceError('dailyInstallment must be greater than 0', 400)
  }
  if (params.penaltyAmount < 0) {
    throw new ServiceError('penaltyAmount must be non-negative', 400)
  }

  return (db as any).transaction(async (tx: AnyDB) => {
    // --- generate loan_number ---
    const [last] = await (tx as any)
      .select({ n: loans.loan_number })
      .from(loans)
      .orderBy(desc(loans.loan_number))
      .limit(1)
    const next = last?.n ? parseInt(last.n.split('-')[1], 10) + 1 : 1001
    const loanNumber = 'LOAN-' + String(next).padStart(6, '0')

    // --- financial math in integer cents ---
    const loanAmountCents = toCents(params.loanAmount)
    const interestCents = Math.round(
      (loanAmountCents * params.interestPercentage) / 100,
    )
    const disbursedCents = loanAmountCents - interestCents
    const dailyCents = toCents(params.dailyInstallment)
    const penaltyCents = toCents(params.penaltyAmount)

    const repaymentStartDate = addDays(params.disbursementDate, 1)

    // --- insert loan ---
    const [loan] = await (tx as any)
      .insert(loans)
      .values({
        loan_number: loanNumber,
        customer_id: params.customerId,
        assigned_agent_id: params.assignedAgentId,
        branch_id: params.branchId,
        loan_amount: String(params.loanAmount),
        interest_percentage: String(params.interestPercentage),
        interest_amount: fromCents(interestCents),
        disbursed_amount: fromCents(disbursedCents),
        daily_installment: String(params.dailyInstallment),
        penalty_amount: fromCents(penaltyCents),
        disbursement_date: params.disbursementDate,
        repayment_start_date: repaymentStartDate,
        principal_collected: '0.00',
        principal_outstanding: String(params.loanAmount),
        penalty_outstanding: '0.00',
        total_outstanding: String(params.loanAmount),
        status: 'ACTIVE',
        notes: params.notes ?? null,
        created_by: params.actorId,
      })
      .returning()

    // --- generate all daily schedules ---
    const schedules: {
      loan_id: string
      scheduled_date: string
      installment_amount: string
      status: string
    }[] = []

    let remainingCents = loanAmountCents
    let scheduleDate = repaymentStartDate
    const MAX_SCHEDULES = 3650 // 10-year safety cap

    while (remainingCents > 0) {
      if (schedules.length >= MAX_SCHEDULES) {
        throw new ServiceError(
          'Loan schedule exceeds 3650 days — check loan amount and daily installment',
          400,
        )
      }
      const thisDayCents = Math.min(dailyCents, remainingCents)
      schedules.push({
        loan_id: loan.id,
        scheduled_date: scheduleDate,
        installment_amount: fromCents(thisDayCents),
        status: 'PENDING',
      })
      remainingCents -= thisDayCents
      scheduleDate = addDays(scheduleDate, 1)
    }

    // Single batch insert — one round-trip for potentially hundreds of rows
    await (tx as any).insert(loanSchedules).values(schedules)

    // --- assign agent (only if one was provided) ---
    if (params.assignedAgentId) {
      await (tx as any).insert(agentLoanAssignments).values({
        loan_id: loan.id,
        agent_id: params.assignedAgentId,
        is_current: true,
        assigned_at: new Date(),
      })
    }

    // --- audit ---
    await logAudit(tx, {
      actor_id: params.actorId,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: 'CREATE',
      entity_type: 'loan',
      entity_id: loan.id,
      after_data: {
        loan_number: loan.loan_number,
        loan_amount: loan.loan_amount,
        daily_installment: loan.daily_installment,
        schedules_generated: schedules.length,
        status: loan.status,
      },
      branch_id: params.branchId,
    })

    return loan
  })
}

// ── updateLoanBalances ────────────────────────────────────────────────────────

/**
 * Recalculates principal_collected, principal_outstanding, penalty_outstanding,
 * total_outstanding from actual payment records. Call inside any transaction
 * that modifies loan_payments or loan_penalties.
 *
 * Marks the loan COMPLETED when both principal and penalty balances reach zero.
 */
export async function updateLoanBalances(
  tx: AnyDB,
  loanId: string,
): Promise<void> {
  // Fetch current loan for loan_amount baseline
  const [loan] = await (tx as any).execute(
    sql`SELECT id, loan_amount, status FROM loans WHERE id = ${loanId}`,
  ) as any[]

  if (!loan) throw new ServiceError('Loan not found', 404)

  // Aggregate principal collected (non-reversed CONFIRMED principal payments)
  const [principalRow] = await (tx as any).execute(
    sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM loan_payments
      WHERE loan_id = ${loanId}
        AND payment_type = 'PRINCIPAL'
        AND is_reversed = false
        AND status = 'CONFIRMED'
    `,
  ) as any[]

  // Aggregate penalty figures
  const [penaltyGenRow] = await (tx as any).execute(
    sql`SELECT COALESCE(SUM(penalty_amount), 0) AS total FROM loan_penalties WHERE loan_id = ${loanId}`,
  ) as any[]

  const [penaltyPaidRow] = await (tx as any).execute(
    sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM loan_payments
      WHERE loan_id = ${loanId}
        AND payment_type = 'PENALTY'
        AND is_reversed = false
    `,
  ) as any[]

  const [penaltyWaivedRow] = await (tx as any).execute(
    sql`SELECT COALESCE(SUM(waived_amount), 0) AS total FROM loan_penalties WHERE loan_id = ${loanId} AND is_waived = true`,
  ) as any[]

  // All arithmetic in cents
  const loanAmountCents = toCents(loan.loan_amount)
  const principalCollectedCents = toCents(principalRow.total)
  const principalOutstandingCents = Math.max(0, loanAmountCents - principalCollectedCents)

  const penaltiesGeneratedCents = toCents(penaltyGenRow.total)
  const penaltiesPaidCents = toCents(penaltyPaidRow.total)
  const penaltiesWaivedCents = toCents(penaltyWaivedRow.total)
  const penaltyOutstandingCents = Math.max(
    0,
    penaltiesGeneratedCents - penaltiesPaidCents - penaltiesWaivedCents,
  )

  const totalOutstandingCents = principalOutstandingCents + penaltyOutstandingCents

  const newStatus =
    principalOutstandingCents <= 0 && penaltyOutstandingCents <= 0
      ? 'COMPLETED'
      : loan.status === 'COMPLETED'
        ? 'ACTIVE' // re-opened by a reversal — revert to ACTIVE (OVERDUE handled by cron)
        : loan.status

  await (tx as any).execute(
    sql`
      UPDATE loans SET
        principal_collected   = ${fromCents(principalCollectedCents)},
        principal_outstanding = ${fromCents(principalOutstandingCents)},
        penalty_outstanding   = ${fromCents(penaltyOutstandingCents)},
        total_outstanding     = ${fromCents(totalOutstandingCents)},
        status                = ${newStatus},
        updated_at            = NOW()
      WHERE id = ${loanId}
    `,
  )
}

// ── getLoanWithDetails ────────────────────────────────────────────────────────

/**
 * Fetches a loan joined with customer name and assigned agent name.
 * Returns null if loan not found.
 */
export async function getLoanWithDetails(
  db: AnyDB,
  loanId: string,
): Promise<LoanWithDetails | null> {
  const [row] = await (db as any).execute(
    sql`
      SELECT
        l.*,
        c.full_name  AS customer_name,
        p.full_name  AS assigned_agent_name
      FROM loans l
      JOIN customers c ON c.id = l.customer_id
      LEFT JOIN profiles  p ON p.id = l.assigned_agent_id
      WHERE l.id = ${loanId}
      LIMIT 1
    `,
  ) as any[]

  if (!row) return null
  return row as LoanWithDetails
}
