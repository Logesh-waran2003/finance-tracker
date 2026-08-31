import { db } from '@/lib/db'
import { loanSchedules, loanPayments } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody } from '@/lib/validation'
import { z } from 'zod'
import { updateLoanBalances } from '@/lib/modules/loans/service'
import { logAudit } from '@/lib/modules/audit/service'
import { ServiceError } from '@/lib/modules/errors'

const bulkCollectSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  payment_mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  payment_reference: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
})

const toCents = (v: string | number) => Math.round(parseFloat(String(v)) * 100)
const fromCents = (c: number) => (c / 100).toFixed(2)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  const parsed = await parseBody(request, bulkCollectSchema)
  if (!parsed.ok) return parsed.response

  const { amount, payment_mode, payment_reference, notes } = parsed.data

  try {
    const result = await db.transaction(async (tx) => {
      // Lock loan row
      const [loan] = await (tx as any).execute(
        sql`SELECT * FROM loans WHERE id = ${id} FOR UPDATE`
      ) as any[]

      if (!loan) throw new ServiceError('Loan not found', 404)
      if (loan.status === 'COMPLETED') throw new ServiceError('Loan is already completed', 400)
      if (loan.status === 'CANCELLED') throw new ServiceError('Loan is cancelled', 400)

      const principalOutstandingCents = toCents(loan.principal_outstanding)
      if (principalOutstandingCents <= 0) throw new ServiceError('No outstanding principal', 400)

      // Cap amount to principal outstanding — never overpay
      const requestedCents = toCents(amount)
      const applyingCents = Math.min(requestedCents, principalOutstandingCents)

      // Get all PENDING schedules in order
      const schedules = await (tx as any)
        .select()
        .from(loanSchedules)
        .where(and(
          eq(loanSchedules.loan_id, id),
          eq(loanSchedules.status, 'PENDING')
        ))
        .orderBy(loanSchedules.scheduled_date) as any[]

      if (schedules.length === 0) throw new ServiceError('No pending schedules to collect against', 400)

      // Get next payment number
      const [lastPay] = await (tx as any).execute(
        sql`SELECT payment_number FROM loan_payments ORDER BY payment_number DESC LIMIT 1`
      ) as any[]
      let nextNum = lastPay?.payment_number
        ? parseInt(lastPay.payment_number.split('-')[1], 10) + 1
        : 1001

      let remainingCents = applyingCents
      const payments: any[] = []

      for (const sched of schedules) {
        if (remainingCents <= 0) break

        // Check no existing non-reversed payment for this schedule
        const [existing] = await (tx as any).execute(
          sql`SELECT id FROM loan_payments WHERE loan_schedule_id = ${sched.id} AND is_reversed = false LIMIT 1`
        ) as any[]
        if (existing) continue // skip already paid schedules

        const schedCents = toCents(sched.installment_amount)
        const collectCents = Math.min(schedCents, remainingCents, toCents(loan.principal_outstanding))

        const paymentNumber = 'PAY-' + String(nextNum).padStart(6, '0')
        nextNum++

        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

        const [payment] = await (tx as any)
          .insert(loanPayments)
          .values({
            payment_number: paymentNumber,
            loan_id: id,
            loan_schedule_id: sched.id,
            customer_id: loan.customer_id,
            agent_id: actor.id,
            branch_id: actor.branch_id ?? loan.branch_id,
            scheduled_date: sched.scheduled_date,
            payment_date: today,
            amount: fromCents(collectCents),
            payment_type: 'PRINCIPAL',
            payment_mode,
            payment_reference: payment_reference ?? null,
            transaction_reference: null,
            status: 'CONFIRMED',
            is_reversed: false,
            created_by: actor.id,
            notes: notes ?? null,
          })
          .returning() as any[]

        // Mark schedule PAID
        await (tx as any).execute(
          sql`UPDATE loan_schedules SET status = 'PAID', paid_at = NOW(), updated_at = NOW() WHERE id = ${sched.id}`
        )

        payments.push(payment)
        remainingCents -= collectCents
      }

      if (payments.length === 0) throw new ServiceError('No eligible schedules to collect against', 400)

      // Recalculate loan balances
      await updateLoanBalances(tx as any, id)

      await logAudit(tx as any, {
        actor_id: actor.id,
        actor_name: actor.name,
        actor_email: actor.email,
        action: 'BULK_COLLECT',
        entity_type: 'loan',
        entity_id: id,
        after_data: {
          payments_created: payments.length,
          total_collected: fromCents(applyingCents - remainingCents),
          payment_mode,
        },
        branch_id: actor.branch_id,
      })

      // Fetch updated loan
      const [updatedLoan] = await (tx as any).execute(
        sql`SELECT principal_collected, principal_outstanding, penalty_outstanding, total_outstanding, status FROM loans WHERE id = ${id}`
      ) as any[]

      return {
        payments_created: payments.length,
        total_collected: fromCents(applyingCents - remainingCents),
        principal_outstanding: updatedLoan.principal_outstanding,
        loan_status: updatedLoan.status,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
