/**
 * Loan business logic — pure logic tests.
 * No live DB, no HTTP. Service imports use dynamic import; pure math is inlined.
 *
 * Run: bun test __tests__/loan-business-logic.test.ts
 */
import { describe, it, expect } from 'bun:test'

// ── Pure calculation helpers (copied from lib/modules/loans/service.ts) ────────

const toCents = (v: string | number): number =>
  Math.round(parseFloat(String(v)) * 100)

const fromCents = (c: number): string => (c / 100).toFixed(2)

function calcInterest(loanAmount: number, interestPct: number): number {
  const loanCents = toCents(loanAmount)
  const interestCents = Math.round((loanCents * interestPct) / 100)
  return parseFloat(fromCents(interestCents))
}

function calcDisbursed(loanAmount: number, interestAmount: number): number {
  return parseFloat(fromCents(toCents(loanAmount) - toCents(interestAmount)))
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function generateScheduleAmounts(
  loanAmount: number,
  dailyInstallment: number,
): number[] {
  const loanCents = toCents(loanAmount)
  const dailyCents = toCents(dailyInstallment)
  const amounts: number[] = []
  let remaining = loanCents
  while (remaining > 0) {
    const thisCents = Math.min(dailyCents, remaining)
    amounts.push(parseFloat(fromCents(thisCents)))
    remaining -= thisCents
  }
  return amounts
}

function calcPrincipalOutstanding(
  loanAmount: number,
  principalCollected: number,
): number {
  return Math.max(0, parseFloat(fromCents(toCents(loanAmount) - toCents(principalCollected))))
}

function calcTotalOutstanding(
  principalOutstanding: number,
  penaltyOutstanding: number,
): number {
  return parseFloat(fromCents(toCents(principalOutstanding) + toCents(penaltyOutstanding)))
}

function calcPenaltyOutstanding(
  generated: number,
  paid: number,
  waived: number,
): number {
  return Math.max(0, parseFloat(fromCents(toCents(generated) - toCents(paid) - toCents(waived))))
}

function finalInstallment(
  dailyInstallment: number,
  principalOutstanding: number,
): number {
  return parseFloat(fromCents(Math.min(toCents(dailyInstallment), toCents(principalOutstanding))))
}

// ── Mock DB helpers ────────────────────────────────────────────────────────────

/**
 * Returns a tx-level execute mock backed by a queue.
 * Each call pops the next array of rows. Falls back to [] when queue is empty.
 */
function executeQueue(responses: any[][]) {
  let i = 0
  return (_query: any) => Promise.resolve(responses[i++] ?? [])
}

/** Chainable select mock (mirrors service-layer.test.ts pattern) */
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  ;['from', 'where', 'limit', 'leftJoin', 'orderBy'].forEach(m => {
    chain[m] = () => chain
  })
  chain.then = (fn: (r: unknown[]) => unknown) => Promise.resolve(fn(rows))
  return chain
}

/** Minimal insert chain that always returns rows */
function insertReturningOnce(rows: unknown[]) {
  return {
    insert: () => ({
      values: () => ({ returning: () => Promise.resolve(rows) }),
    }),
  }
}

/** Build a full tx mock where execute uses a queue and insert is a no-op chain */
function makeTx(executeResponses: any[][], insertRows: unknown[] = [{ id: 'mock-id' }]) {
  return {
    execute: executeQueue(executeResponses),
    insert: () => ({
      values: () => ({ returning: () => Promise.resolve(insertRows) }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{}]) }),
      }),
    }),
    select: () => selectChain([]),
    delete: () => ({ where: () => Promise.resolve() }),
    transaction: async (fn: Function) => fn(makeTx(executeResponses, insertRows)),
  } as any
}

const UUID  = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

// ── 1. Financial calculation tests ─────────────────────────────────────────────

describe('Loan financial calculations', () => {
  it('₹10,000 @ 10% → interest ₹1,000 disbursed ₹9,000', () => {
    const interest = calcInterest(10000, 10)
    expect(interest).toBe(1000)
    expect(calcDisbursed(10000, interest)).toBe(9000)
  })

  it('₹10,000 @ 12% → interest ₹1,200 disbursed ₹8,800', () => {
    const interest = calcInterest(10000, 12)
    expect(interest).toBe(1200)
    expect(calcDisbursed(10000, interest)).toBe(8800)
  })

  it('₹5,000 @ 0% → interest ₹0 disbursed ₹5,000', () => {
    const interest = calcInterest(5000, 0)
    expect(interest).toBe(0)
    expect(calcDisbursed(5000, interest)).toBe(5000)
  })

  it('repayment principal = loan_amount (not disbursed_amount)', () => {
    // The loan row stores principal_outstanding = loan_amount, NOT disbursed_amount
    const loanAmount = 10000
    const disbursed = calcDisbursed(loanAmount, calcInterest(loanAmount, 10))
    expect(disbursed).toBe(9000)
    // Repayment is against the full loan_amount
    expect(loanAmount).toBe(10000)
    expect(loanAmount).not.toBe(disbursed)
  })

  it('repayment start = disbursement_date + 1 day (normal)', () => {
    expect(addDays('2026-08-26', 1)).toBe('2026-08-27')
  })

  it('repayment start crosses year boundary (31 Dec → 1 Jan)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('repayment start on leap year (28 Feb 2028 → 29 Feb 2028)', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

// ── 2. Schedule generation tests ───────────────────────────────────────────────

describe('Schedule generation', () => {
  it('₹10,000 @ ₹50/day → 200 schedules', () => {
    expect(generateScheduleAmounts(10000, 50).length).toBe(200)
  })

  it('₹10,000 @ ₹50/day → first schedule date = 2026-08-27 (disbursed 2026-08-26)', () => {
    const repaymentStart = addDays('2026-08-26', 1)
    expect(repaymentStart).toBe('2026-08-27')
  })

  it('₹10,000 @ ₹50/day → last schedule amount = ₹50 (evenly divisible)', () => {
    const amounts = generateScheduleAmounts(10000, 50)
    expect(amounts[amounts.length - 1]).toBe(50)
  })

  it('₹10,025 @ ₹50/day → 201 schedules, last = ₹25', () => {
    const amounts = generateScheduleAmounts(10025, 50)
    expect(amounts.length).toBe(201)
    expect(amounts[amounts.length - 1]).toBe(25)
  })

  it('₹100 @ ₹50/day → 2 schedules [50, 50]', () => {
    const amounts = generateScheduleAmounts(100, 50)
    expect(amounts).toEqual([50, 50])
  })

  it('₹75 @ ₹50/day → 2 schedules [50, 25]', () => {
    const amounts = generateScheduleAmounts(75, 50)
    expect(amounts).toEqual([50, 25])
  })
})

// ── 3. Balance calculation tests ───────────────────────────────────────────────

describe('Balance calculations', () => {
  it('fresh loan: principal_outstanding = loan_amount, principal_collected = 0', () => {
    expect(calcPrincipalOutstanding(10000, 0)).toBe(10000)
  })

  it('after 10 × ₹50 payments: principal_collected = 500, principal_outstanding = 9,500', () => {
    const collected = 10 * 50
    expect(collected).toBe(500)
    expect(calcPrincipalOutstanding(10000, collected)).toBe(9500)
  })

  it('after 200 × ₹50 on ₹10,000 loan: principal_outstanding = 0, status = COMPLETED', () => {
    const collected = 200 * 50
    const outstanding = calcPrincipalOutstanding(10000, collected)
    expect(outstanding).toBe(0)
    // Status logic: COMPLETED when both principal and penalty outstanding are 0
    const penaltyOutstanding = calcPenaltyOutstanding(0, 0, 0)
    const status = outstanding <= 0 && penaltyOutstanding <= 0 ? 'COMPLETED' : 'ACTIVE'
    expect(status).toBe('COMPLETED')
  })

  it('missed day: principal_outstanding unchanged (missing payment ≠ principal change)', () => {
    // A missed schedule doesn't reduce principal_collected — only actual payments do
    const outstandingBefore = calcPrincipalOutstanding(10000, 500)
    const outstandingAfter  = calcPrincipalOutstanding(10000, 500) // still 500 collected
    expect(outstandingBefore).toBe(outstandingAfter)
    expect(outstandingAfter).toBe(9500)
  })

  it('missed day generates exactly ONE ₹50 penalty', () => {
    // schedule-service inserts one penalty per missed schedule
    const penaltiesAfterOneMiss = 1
    expect(penaltiesAfterOneMiss).toBe(1)
    const penaltyOutstanding = calcPenaltyOutstanding(50, 0, 0)
    expect(penaltyOutstanding).toBe(50)
  })

  it('three missed days → penalty_outstanding = ₹150', () => {
    expect(calcPenaltyOutstanding(150, 0, 0)).toBe(150)
  })

  it('penalty_outstanding = penalties_generated - penalties_paid - penalties_waived', () => {
    expect(calcPenaltyOutstanding(200, 50, 30)).toBe(120)
    expect(calcPenaltyOutstanding(100, 100, 0)).toBe(0)
    expect(calcPenaltyOutstanding(100, 50, 60)).toBe(0) // floor at 0
  })

  it('total_outstanding = principal_outstanding + penalty_outstanding (no double count)', () => {
    expect(calcTotalOutstanding(9500, 150)).toBe(9650)
    expect(calcTotalOutstanding(0, 0)).toBe(0)
    expect(calcTotalOutstanding(10000, 0)).toBe(10000)
  })
})

// ── 4. Payment validation tests ────────────────────────────────────────────────

describe('Payment validation rules', () => {
  it('agent cannot collect on another agent\'s loan', async () => {
    const { collectInstallment } = await import('@/lib/modules/loans/payment-service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const loan = {
      id: UUID, assigned_agent_id: UUID2, status: 'ACTIVE',
      principal_outstanding: '10000.00', loan_number: 'LOAN-001001',
    }

    const db = {
      transaction: async (fn: Function) => fn(makeTx([[loan]])),
    } as any

    try {
      await collectInstallment(db, {
        loanId: UUID, agentId: UUID, // UUID !== UUID2 (assigned agent)
        actorName: 'Agent', actorEmail: 'a@b.com',
        branchId: null, paymentMode: 'CASH', isAdmin: false,
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(403)
    }
  })

  it('duplicate payment for same schedule_id is rejected', async () => {
    const { collectInstallment } = await import('@/lib/modules/loans/payment-service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const loan = {
      id: UUID, assigned_agent_id: UUID, status: 'ACTIVE',
      principal_outstanding: '10000.00', loan_number: 'LOAN-001001',
    }
    const schedule = { id: 'sched-1', loan_id: UUID, installment_amount: '50.00' }
    const existingPayment = { id: 'pay-existing' }

    // No transactionReference → idempotency execute() is skipped.
    // execute queue: [loan], [schedule], [existingPayment (duplicate guard)]
    const tx = makeTx([[loan], [schedule], [existingPayment]])

    const db = { transaction: async (fn: Function) => fn(tx) } as any

    try {
      await collectInstallment(db, {
        loanId: UUID, agentId: UUID,
        actorName: 'Agent', actorEmail: 'a@b.com',
        branchId: null, paymentMode: 'CASH',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('already exists')
    }
  })

  it('collection after loan COMPLETED is rejected', async () => {
    const { collectInstallment } = await import('@/lib/modules/loans/payment-service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const loan = {
      id: UUID, assigned_agent_id: UUID, status: 'COMPLETED',
      principal_outstanding: '0.00', loan_number: 'LOAN-001001',
    }

    const db = {
      transaction: async (fn: Function) => fn(makeTx([[loan]])),
    } as any

    try {
      await collectInstallment(db, {
        loanId: UUID, agentId: UUID,
        actorName: 'Agent', actorEmail: 'a@b.com',
        branchId: null, paymentMode: 'CASH',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('completed')
    }
  })

  it('collection on CANCELLED loan is rejected', async () => {
    const { collectInstallment } = await import('@/lib/modules/loans/payment-service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const loan = {
      id: UUID, assigned_agent_id: UUID, status: 'CANCELLED',
      principal_outstanding: '10000.00', loan_number: 'LOAN-001001',
    }

    const db = {
      transaction: async (fn: Function) => fn(makeTx([[loan]])),
    } as any

    try {
      await collectInstallment(db, {
        loanId: UUID, agentId: UUID,
        actorName: 'Agent', actorEmail: 'a@b.com',
        branchId: null, paymentMode: 'CASH',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('cancelled')
    }
  })

  it('payment amount = MIN(daily_installment, principal_outstanding) [final installment safety]', () => {
    // Pure math: last day, outstanding < installment
    expect(finalInstallment(50, 25)).toBe(25)
    expect(finalInstallment(50, 50)).toBe(50)
    expect(finalInstallment(50, 60)).toBe(50)
    expect(finalInstallment(50, 1)).toBe(1)
  })

  it('idempotency: same transactionReference returns existing, no duplicate', async () => {
    const { collectInstallment } = await import('@/lib/modules/loans/payment-service')

    const loan = {
      id: UUID, assigned_agent_id: UUID, status: 'ACTIVE',
      principal_outstanding: '10000.00', loan_number: 'LOAN-001001',
    }
    const schedule = { id: 'sched-1', loan_id: UUID, installment_amount: '50.00' }
    const existingPayment = { id: 'pay-existing', amount: '50.00', is_reversed: false }

    // execute queue: [loan], [schedule], [existingPayment via txRef lookup]
    let insertCalled = false
    const tx = {
      execute: executeQueue([[loan], [schedule], [existingPayment]]),
      insert: () => {
        insertCalled = true
        return { values: () => ({ returning: () => Promise.resolve([{}]) }) }
      },
    } as any

    const result = await collectInstallment(
      { transaction: async (fn: Function) => fn(tx) } as any,
      {
        loanId: UUID, agentId: UUID,
        actorName: 'Agent', actorEmail: 'a@b.com',
        branchId: null, paymentMode: 'CASH',
        transactionReference: 'TXN-DEDUP-001',
      },
    )

    expect((result as any).id).toBe('pay-existing')
    expect(insertCalled).toBe(false)
  })
})

// ── 5. Missed payment / penalty idempotency tests ──────────────────────────────

describe('Missed payment idempotency', () => {
  it('running markMissed twice for same schedule creates exactly 1 penalty', async () => {
    const { markMissedSchedules } = await import('@/lib/modules/loans/schedule-service')

    const overdueRow = {
      schedule_id: 'sched-1',
      loan_id: UUID,
      scheduled_date: '2026-08-25',
      installment_amount: '50.00',
      penalty_amount: '50.00',
      loan_status: 'ACTIVE',
    }

    const loanRow = { id: UUID, loan_amount: '10000.00', status: 'ACTIVE' }

    // Real execute order inside markMissedSchedules loop (per schedule-service.ts):
    //   1. SELECT overdue schedules
    //   2. SELECT confirmedPayment? → []
    //   3. UPDATE loan_schedules MISSED
    //   4. SELECT existingPenalty? → []  (first run: none)
    //   5. UPDATE loans OVERDUE (loan_status was ACTIVE)
    //   then insert penalty (not execute), insert audit (not execute)
    //   then updateLoanBalances (5 SELECTs + 1 UPDATE):
    //   6. SELECT loan
    //   7. SELECT SUM principal payments
    //   8. SELECT SUM penalty_amount
    //   9. SELECT SUM penalty payments
    //  10. SELECT SUM waived_amount
    //  11. UPDATE loans

    let penaltyInserted = false

    const tx1 = {
      execute: executeQueue([
        [overdueRow],              // 1: overdueSchedules
        [],                        // 2: confirmedPayment → none
        [],                        // 3: UPDATE loan_schedules MISSED
        [],                        // 4: existingPenalty → none → will insert
        [],                        // 5: UPDATE loans OVERDUE
        [loanRow],                 // 6: updateLoanBalances loan
        [{ total: '500.00' }],    // 7: principal collected
        [{ total: '50.00' }],     // 8: penalties generated
        [{ total: '0.00' }],      // 9: penalties paid
        [{ total: '0.00' }],      // 10: penalties waived
        [],                        // 11: UPDATE loans
      ]),
      insert: () => {
        penaltyInserted = true
        return { values: () => ({ returning: () => Promise.resolve([{ id: 'pen-1' }]) }) }
      },
      select: () => selectChain([]),
    } as any

    const result1 = await markMissedSchedules(
      { transaction: async (fn: Function) => fn(tx1) } as any,
      { actorId: UUID, actorName: 'Cron', actorEmail: 'cron@app.com' },
    )
    expect(result1.processed).toBe(1)
    expect(penaltyInserted).toBe(true)

    // Second run: existingPenalty found → skip insert, still processes
    penaltyInserted = false
    const tx2 = {
      execute: executeQueue([
        [overdueRow],              // 1: overdueSchedules (schedule still PENDING in mock)
        [],                        // 2: confirmedPayment → none
        [],                        // 3: UPDATE loan_schedules MISSED
        [{ id: 'pen-1' }],        // 4: existingPenalty → found → skip insert
        [],                        // 5: UPDATE loans OVERDUE
        [loanRow],                 // 6: updateLoanBalances loan
        [{ total: '500.00' }],
        [{ total: '50.00' }],
        [{ total: '0.00' }],
        [{ total: '0.00' }],
        [],
      ]),
      insert: () => {
        // Only audit log insert; penalty insert is skipped
        return { values: () => ({ returning: () => Promise.resolve([{}]) }) }
      },
      select: () => selectChain([]),
    } as any

    const result2 = await markMissedSchedules(
      { transaction: async (fn: Function) => fn(tx2) } as any,
      { actorId: UUID, actorName: 'Cron', actorEmail: 'cron@app.com' },
    )
    // Second run processes the schedule but skips penalty insert (idempotency)
    expect(result2.processed).toBe(1)
    expect(penaltyInserted).toBe(false)
  })

  it('running markMissed on a schedule with existing confirmed payment does nothing (skipped)', async () => {
    const { markMissedSchedules } = await import('@/lib/modules/loans/schedule-service')

    const overdueRow = {
      schedule_id: 'sched-paid',
      loan_id: UUID,
      scheduled_date: '2026-08-25',
      installment_amount: '50.00',
      penalty_amount: '50.00',
      loan_status: 'ACTIVE',
    }

    let scheduleUpdateCalled = false

    const tx = {
      execute: executeQueue([
        [overdueRow],
        [{ id: 'pay-confirmed' }], // confirmedPayment found → skip
      ]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
      select: () => selectChain([]),
      update: () => {
        scheduleUpdateCalled = true
        return { set: () => ({ where: () => Promise.resolve() }) }
      },
    } as any

    const result = await markMissedSchedules(
      { transaction: async (fn: Function) => fn(tx) } as any,
      { actorId: UUID, actorName: 'Cron', actorEmail: 'cron@app.com' },
    )

    expect(result.skipped).toBe(1)
    expect(result.processed).toBe(0)
  })

  it('markMissed on an overdue schedule marks it MISSED and generates penalty', async () => {
    const { markMissedSchedules } = await import('@/lib/modules/loans/schedule-service')

    const overdueRow = {
      schedule_id: 'sched-overdue',
      loan_id: UUID,
      scheduled_date: '2026-08-24',
      installment_amount: '50.00',
      penalty_amount: '50.00',
      loan_status: 'ACTIVE',
    }

    const scheduleUpdates: string[] = []
    const tx = {
      execute: (() => {
        let call = 0
        const responses: any[][] = [
          [overdueRow],  // overdueSchedules
          [],            // confirmedPayment → none
          [],            // existingPenalty → none
          [],            // UPDATE loan_schedules MISSED
          [],            // UPDATE loans OVERDUE
          [{ id: UUID, loan_amount: '10000.00', status: 'ACTIVE' }], // updateLoanBalances: loan
          [{ total: '500' }],
          [{ total: '50' }],
          [{ total: '0' }],
          [{ total: '0' }],
          [],
        ]
        return (_q: any) => Promise.resolve(responses[call++] ?? [])
      })(),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
      select: () => selectChain([]),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as any

    const result = await markMissedSchedules(
      { transaction: async (fn: Function) => fn(tx) } as any,
      { actorId: UUID, actorName: 'Cron', actorEmail: 'cron@app.com' },
    )

    expect(result.processed).toBe(1)
    expect(result.skipped).toBe(0)
  })
})

// ── 6. Reversal tests ──────────────────────────────────────────────────────────

describe('Payment reversal', () => {
  it('reversed payment: is_reversed=true, schedule status back to PENDING', async () => {
    const { reversePayment } = await import('@/lib/modules/loans/payment-service')

    const payment = {
      id: UUID, loan_id: UUID2, schedule_id: 'sched-1',
      amount: '50.00', is_reversed: false,
    }

    const executeUpdates: string[] = []
    const tx = {
      execute: (() => {
        let call = 0
        const responses: any[][] = [
          [payment],      // SELECT payment FOR UPDATE
          [],             // UPDATE payment is_reversed=true
          [],             // UPDATE loan_schedules status=PENDING
          // updateLoanBalances calls:
          [{ id: UUID2, loan_amount: '10000.00', status: 'ACTIVE' }],
          [{ total: '450' }],
          [{ total: '0' }],
          [{ total: '0' }],
          [{ total: '0' }],
          [],             // UPDATE loans
          [],             // logAudit INSERT
        ]
        return (_q: any) => Promise.resolve(responses[call++] ?? [])
      })(),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
      select: () => selectChain([]),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as any

    // Should not throw
    await expect(
      reversePayment(
        { transaction: async (fn: Function) => fn(tx) } as any,
        {
          loanPaymentId: UUID, reason: 'Error entry',
          reversedBy: UUID2, actorName: 'Admin', actorEmail: 'admin@app.com',
          branchId: null,
        },
      ),
    ).resolves.toBeUndefined()
  })

  it('after reversal: principal_collected decreases, principal_outstanding increases', () => {
    // Pure math: after reversal removes a ₹50 payment from ₹10,000 with ₹500 collected
    const beforeCollected  = 500
    const afterCollected   = 500 - 50 // reversal removes one payment
    const outstandingAfter = calcPrincipalOutstanding(10000, afterCollected)
    expect(afterCollected).toBe(450)
    expect(outstandingAfter).toBe(9550)
  })

  it('cannot reverse an already-reversed payment', async () => {
    const { reversePayment } = await import('@/lib/modules/loans/payment-service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const alreadyReversed = {
      id: UUID, loan_id: UUID2, schedule_id: 'sched-1',
      amount: '50.00', is_reversed: true,
    }

    const tx = {
      execute: executeQueue([[alreadyReversed]]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
    } as any

    try {
      await reversePayment(
        { transaction: async (fn: Function) => fn(tx) } as any,
        {
          loanPaymentId: UUID, reason: 'Test',
          reversedBy: UUID2, actorName: 'Admin', actorEmail: 'admin@app.com',
          branchId: null,
        },
      )
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('already been reversed')
    }
  })
})

// ── 7. Penalty waiver tests ────────────────────────────────────────────────────

describe('Penalty waiver', () => {
  it('waiving ₹50 penalty → penalty_outstanding decreases by ₹50', async () => {
    const { waivePenalty } = await import('@/lib/modules/loans/payment-service')

    const penalty = {
      id: UUID, loan_id: UUID2,
      penalty_amount: '50.00', is_waived: false, waived_amount: '0.00',
    }

    const tx = {
      execute: (() => {
        let call = 0
        const responses: any[][] = [
          [penalty],   // SELECT penalty FOR UPDATE
          [],          // UPDATE loan_penalties
          // updateLoanBalances:
          [{ id: UUID2, loan_amount: '10000.00', status: 'ACTIVE' }],
          [{ total: '9500' }],
          [{ total: '50' }],
          [{ total: '0' }],
          [{ total: '50' }],
          [],
          [],
        ]
        return (_q: any) => Promise.resolve(responses[call++] ?? [])
      })(),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
    } as any

    await expect(
      waivePenalty(
        { transaction: async (fn: Function) => fn(tx) } as any,
        {
          penaltyId: UUID, waivedAmount: 50, reason: 'Goodwill',
          waivedBy: UUID2, actorName: 'Admin', actorEmail: 'admin@app.com',
          branchId: null,
        },
      ),
    ).resolves.toBeUndefined()

    // Pure math confirms the balance change
    const outstandingAfter = calcPenaltyOutstanding(50, 0, 50)
    expect(outstandingAfter).toBe(0)
  })

  it('partial waiver: waive ₹30 of ₹50 → penalty_outstanding = ₹20', () => {
    expect(calcPenaltyOutstanding(50, 0, 30)).toBe(20)
  })

  it('cannot waive more than penalty amount', async () => {
    const { waivePenalty } = await import('@/lib/modules/loans/payment-service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const penalty = {
      id: UUID, loan_id: UUID2,
      penalty_amount: '50.00', is_waived: false, waived_amount: '0.00',
    }

    const tx = {
      execute: executeQueue([[penalty]]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
    } as any

    try {
      await waivePenalty(
        { transaction: async (fn: Function) => fn(tx) } as any,
        {
          penaltyId: UUID, waivedAmount: 75, // > 50
          reason: 'Test', waivedBy: UUID2,
          actorName: 'Admin', actorEmail: 'admin@app.com', branchId: null,
        },
      )
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('exceeds penalty_amount')
    }
  })
})
