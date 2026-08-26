/**
 * Loan schedule service — daily schedule queries and missed-payment cron logic.
 * No NextRequest/Response — auth stays in the route layer.
 */
import { loanSchedules, loanPenalties, loans } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
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

/** Returns today's date string (YYYY-MM-DD) in Asia/Kolkata timezone */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  )
}

/** Subtract N calendar days from a YYYY-MM-DD string */
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ── types ─────────────────────────────────────────────────────────────────────

export type ScheduleRecord = typeof loanSchedules.$inferSelect

export type MarkMissedParams = {
  actorId: string
  actorName: string
  actorEmail: string
}

// ── getTodaySchedule ──────────────────────────────────────────────────────────

/**
 * Returns the PENDING schedule for today for a given loan, or null if none.
 * Callers pass today explicitly so they control the timezone/date.
 */
export async function getTodaySchedule(
  db: AnyDB,
  loanId: string,
  today: string,
): Promise<ScheduleRecord | null> {
  const [row] = await (db as any)
    .select()
    .from(loanSchedules)
    .where(
      sql`${loanSchedules.loan_id} = ${loanId}
          AND ${loanSchedules.scheduled_date} = ${today}
          AND ${loanSchedules.status} = 'PENDING'`,
    )
    .limit(1)

  return row ?? null
}

// ── markMissedSchedules ───────────────────────────────────────────────────────

/**
 * Daily cron logic — marks all overdue PENDING schedules as MISSED, inserts
 * penalties, and sets affected loans to OVERDUE. Idempotent.
 *
 * Runs inside a single transaction for atomicity. On large portfolios consider
 * chunking by loan; this implementation processes all at once.
 */
export async function markMissedSchedules(
  db: AnyDB,
  params: MarkMissedParams,
): Promise<{ processed: number; skipped: number }> {
  return (db as any).transaction(async (tx: AnyDB) => {
    const today = todayIST()
    const yesterday = subtractDays(today, 1)

    // All PENDING schedules whose date has passed, for ACTIVE or OVERDUE loans
    const overdueSchedules = await (tx as any).execute(
      sql`
        SELECT
          ls.id            AS schedule_id,
          ls.loan_id,
          ls.scheduled_date,
          ls.installment_amount,
          l.penalty_amount,
          l.status         AS loan_status
        FROM loan_schedules ls
        JOIN loans l ON l.id = ls.loan_id
        WHERE ls.status = 'PENDING'
          AND ls.scheduled_date <= ${yesterday}
          AND l.status IN ('ACTIVE', 'OVERDUE')
      `,
    ) as any[]

    let processed = 0
    let skipped = 0
    const affectedLoanIds = new Set<string>()

    for (const row of overdueSchedules) {
      // Idempotency: skip if a CONFIRMED payment already covers this schedule
      const [confirmedPayment] = await (tx as any).execute(
        sql`
          SELECT id FROM loan_payments
          WHERE schedule_id = ${row.schedule_id}
            AND status = 'CONFIRMED'
            AND is_reversed = false
          LIMIT 1
        `,
      ) as any[]

      if (confirmedPayment) {
        skipped++
        continue
      }

      // Mark schedule MISSED
      await (tx as any).execute(
        sql`
          UPDATE loan_schedules
          SET status = 'MISSED', updated_at = NOW()
          WHERE id = ${row.schedule_id}
        `,
      )

      // Idempotency: skip penalty insert if one already exists for this schedule
      const [existingPenalty] = await (tx as any).execute(
        sql`
          SELECT id FROM loan_penalties
          WHERE schedule_id = ${row.schedule_id}
          LIMIT 1
        `,
      ) as any[]

      if (!existingPenalty) {
        await (tx as any).insert(loanPenalties).values({
          loan_id: row.loan_id,
          schedule_id: row.schedule_id,
          penalty_amount: String(row.penalty_amount),
          penalty_date: row.scheduled_date,
          is_waived: false,
          waived_amount: '0.00',
        })
      }

      // Flip loan to OVERDUE if not already
      if (row.loan_status !== 'OVERDUE') {
        await (tx as any).execute(
          sql`UPDATE loans SET status = 'OVERDUE', updated_at = NOW() WHERE id = ${row.loan_id}`,
        )
      }

      await logAudit(tx, {
        actor_id: params.actorId,
        actor_name: params.actorName,
        actor_email: params.actorEmail,
        action: 'MISSED_PAYMENT',
        entity_type: 'loan_schedule',
        entity_id: row.schedule_id,
        after_data: {
          loan_id: row.loan_id,
          scheduled_date: row.scheduled_date,
          installment_amount: row.installment_amount,
          penalty_generated: !existingPenalty,
        },
        branch_id: null,
      })

      affectedLoanIds.add(row.loan_id)
      processed++
    }

    // Recalculate balances for every loan that was touched
    for (const loanId of affectedLoanIds) {
      await updateLoanBalances(tx, loanId)
    }

    return { processed, skipped }
  })
}
