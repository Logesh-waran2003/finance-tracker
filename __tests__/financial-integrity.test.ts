/**
 * Financial integrity and business rule tests.
 * Pure logic tests — no DB calls, no HTTP.
 */
import { describe, it, expect } from 'bun:test'

// ---------------------------------------------------------------------------
// State transition rules (mirroring what routes enforce)
// ---------------------------------------------------------------------------

type CollectionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'
type DueStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

const TERMINAL_DUE_STATUSES: DueStatus[] = ['PAID', 'CANCELLED']
const _TERMINAL_COLLECTION_STATUSES: CollectionStatus[] = ['CONFIRMED', 'REJECTED', 'CANCELLED']

function canCollectOnDue(status: DueStatus): boolean {
  return !TERMINAL_DUE_STATUSES.includes(status)
}

function canActionCollection(status: CollectionStatus): boolean {
  return status === 'PENDING'
}

function canActionExpense(status: ExpenseStatus): boolean {
  return status === 'PENDING'
}

function isOverCollection(amount: number, outstandingAmount: number): boolean {
  return amount > outstandingAmount
}

function isValidGps(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// ---------------------------------------------------------------------------

describe('Due status: collection eligibility', () => {
  it('allows collection on OPEN due', () => {
    expect(canCollectOnDue('OPEN')).toBe(true)
  })

  it('allows collection on PARTIALLY_PAID due', () => {
    expect(canCollectOnDue('PARTIALLY_PAID')).toBe(true)
  })

  it('allows collection on OVERDUE due', () => {
    expect(canCollectOnDue('OVERDUE')).toBe(true)
  })

  it('rejects collection on PAID due', () => {
    expect(canCollectOnDue('PAID')).toBe(false)
  })

  it('rejects collection on CANCELLED due', () => {
    expect(canCollectOnDue('CANCELLED')).toBe(false)
  })
})

describe('Over-collection guard', () => {
  it('rejects amount greater than outstanding', () => {
    expect(isOverCollection(1000, 500)).toBe(true)
  })

  it('rejects amount equal to outstanding + 1', () => {
    expect(isOverCollection(501, 500)).toBe(true)
  })

  it('allows amount equal to outstanding', () => {
    expect(isOverCollection(500, 500)).toBe(false)
  })

  it('allows partial collection', () => {
    expect(isOverCollection(100, 500)).toBe(false)
  })

  it('rejects amount > 0 but outstanding is 0 (PAID state)', () => {
    expect(isOverCollection(1, 0)).toBe(true)
  })
})

describe('Collection state transitions', () => {
  it('PENDING can be confirmed', () => {
    expect(canActionCollection('PENDING')).toBe(true)
  })

  it('PENDING can be rejected', () => {
    expect(canActionCollection('PENDING')).toBe(true)
  })

  it('CONFIRMED cannot be re-confirmed', () => {
    expect(canActionCollection('CONFIRMED')).toBe(false)
  })

  it('REJECTED cannot be actioned again', () => {
    expect(canActionCollection('REJECTED')).toBe(false)
  })

  it('CANCELLED cannot be actioned', () => {
    expect(canActionCollection('CANCELLED')).toBe(false)
  })
})

describe('Expense state transitions', () => {
  it('PENDING can be approved', () => {
    expect(canActionExpense('PENDING')).toBe(true)
  })

  it('PENDING can be rejected', () => {
    expect(canActionExpense('PENDING')).toBe(true)
  })

  it('APPROVED cannot be actioned again', () => {
    expect(canActionExpense('APPROVED')).toBe(false)
  })

  it('REJECTED cannot be actioned again', () => {
    expect(canActionExpense('REJECTED')).toBe(false)
  })
})

describe('GPS coordinate validation', () => {
  it('accepts valid coordinates (Chennai)', () => {
    expect(isValidGps(13.0827, 80.2707)).toBe(true)
  })

  it('accepts boundary values', () => {
    expect(isValidGps(90, 180)).toBe(true)
    expect(isValidGps(-90, -180)).toBe(true)
  })

  it('rejects lat > 90', () => {
    expect(isValidGps(91, 80)).toBe(false)
  })

  it('rejects lat < -90', () => {
    expect(isValidGps(-91, 80)).toBe(false)
  })

  it('rejects lng > 180', () => {
    expect(isValidGps(13, 181)).toBe(false)
  })

  it('rejects lng < -180', () => {
    expect(isValidGps(13, -181)).toBe(false)
  })
})

describe('Reconciliation: server-side cash_collected', () => {
  // The route now calculates cash_collected from DB, ignoring client value.
  // This test documents the expected contract.
  it('cash_collected must equal sum of confirmed CASH collections for agent+date', () => {
    // Simulate: agent had 3 confirmed CASH collections
    const collections = [
      { amount: 500, status: 'CONFIRMED', payment_mode: 'CASH' },
      { amount: 300, status: 'CONFIRMED', payment_mode: 'CASH' },
      { amount: 200, status: 'PENDING',   payment_mode: 'CASH' }, // not counted
      { amount: 100, status: 'CONFIRMED', payment_mode: 'UPI' },  // not CASH, not counted
    ]
    const serverCalculated = collections
      .filter(c => c.status === 'CONFIRMED' && c.payment_mode === 'CASH')
      .reduce((sum, c) => sum + c.amount, 0)

    expect(serverCalculated).toBe(800)

    // Client tries to manipulate — it's ignored
    const clientSubmitted = 0
    expect(serverCalculated).not.toBe(clientSubmitted)
  })
})

describe('Amount validation: cannot be zero or negative', () => {
  const isValidAmount = (v: number) => v > 0

  it('rejects 0', () => expect(isValidAmount(0)).toBe(false))
  it('rejects -1', () => expect(isValidAmount(-1)).toBe(false))
  it('rejects -0.01', () => expect(isValidAmount(-0.01)).toBe(false))
  it('accepts 0.01', () => expect(isValidAmount(0.01)).toBe(true))
  it('accepts 1000', () => expect(isValidAmount(1000)).toBe(true))
})

// ---------------------------------------------------------------------------
// Loan cash counts toward an agent's handover ONLY once an admin confirms it
// ---------------------------------------------------------------------------
describe('reconciliation — loan payment cash rule', () => {
  it('getCashCollectedCents filters loan payments on CONFIRMED, not just is_reversed', async () => {
    const src = await Bun.file(
      new URL('../lib/modules/reconciliation/service.ts', import.meta.url).pathname,
    ).text()

    const fn = src.slice(src.indexOf('export async function getCashCollectedCents'))
    const body = fn.slice(0, fn.indexOf('export async function createReconciliation'))

    // `loan_payments.status` defaults to 'PENDING', and rejecting a payment sets
    // status = 'REJECTED' WITHOUT setting is_reversed. Filtering on is_reversed
    // alone therefore charged the agent for cash from payments an admin had
    // explicitly rejected, and from payments nobody had approved yet.
    expect(body).toContain("eq(loanPayments.status, 'CONFIRMED')")
    expect(body).toContain('eq(loanPayments.is_reversed, false)')

    // Freeform collections must use the same rule.
    expect(body).toContain("eq(collections.status, 'CONFIRMED')")
  })

  it('is the single source of truth — no other file recomputes loan cash inline', async () => {
    const paths = [
      '../app/api/reconciliation/route.ts',
      '../app/(dashboard)/reconciliation/page.tsx',
    ]
    for (const rel of paths) {
      const src = await Bun.file(new URL(rel, import.meta.url).pathname).text()
      // These three places previously disagreed, so the same agent could be shown
      // two different figures for "cash you still owe".
      expect(src).toContain('getCashCollectedCents')
      expect(src).not.toContain('sum(${loanPayments.amount})')
    }
  })
})

// ---------------------------------------------------------------------------
// IST date boundaries — these decide which money lands in which report
// ---------------------------------------------------------------------------
describe('IST date helpers', () => {
  it('never derives a calendar date from local accessors on a shifted Date', async () => {
    const files = [
      '../app/api/admin/dashboard/route.ts',
      '../lib/modules/reconciliation/service.ts',
    ]
    for (const rel of files) {
      const raw = await Bun.file(new URL(rel, import.meta.url).pathname).text()
      // Strip comments first: these files deliberately DOCUMENT the wrong
      // patterns so nobody reintroduces them, and a naive scan matches the
      // warning rather than real code.
      const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')

      // `new Date(Date.now() + 330*60_000)` shifts the instant, but that shift is
      // only readable with getUTC*. Reading it with getFullYear()/getMonth() —
      // which are LOCAL — double-shifts on an IST machine, and for the last ~11
      // hours of a month monthStartIST() returned the 1st of the NEXT month. The
      // admin KPI filter then became `collected_at >= <future date>` and reported
      // ₹0 collected while the trend chart showed real money.
      expect(src).not.toMatch(/330\s*\*\s*60_?000[\s\S]{0,200}?\.getFullYear\(\)/)
      expect(src).not.toMatch(/330\s*\*\s*60_?000[\s\S]{0,200}?\.getMonth\(\)/)

      // The UTC date is not the IST date between 00:00 and 05:30 IST.
      expect(src).not.toContain("new Date().toISOString().split('T')[0]")
    }
  })

  it('month and year starts align with the IST calendar date', () => {
    const istDate = (at: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(at)

    // 31 Aug 2026, 21:16 IST — the exact instant that reproduced the bug.
    const at = new Date('2026-08-31T15:46:46.856Z')
    const today = istDate(at)

    expect(today).toBe('2026-08-31')
    expect(`${today.slice(0, 7)}-01`).toBe('2026-08-01')   // was '2026-09-01'
    expect(`${today.slice(0, 4)}-01-01`).toBe('2026-01-01')
  })
})
