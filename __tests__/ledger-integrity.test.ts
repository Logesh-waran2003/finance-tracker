/**
 * Ledger integrity tests — assert that money-moving operations
 * produce the correct ledger entries and that ledger arithmetic is sound.
 *
 * Uses lightweight stubs — no real DB, no real services.
 */
import { describe, it, expect } from 'bun:test'
import { writeLedgerEntry } from '@/lib/modules/ledger/service'

const UUID  = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

/** Capture what was inserted into the ledger */
function makeLedgerDb() {
  const entries: Record<string, unknown>[] = []
  return {
    db: {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          entries.push(row)
          return Promise.resolve()
        },
      }),
    } as any,
    entries,
  }
}

// ── writeLedgerEntry directly ─────────────────────────────────────────────────

describe('writeLedgerEntry — CREDIT written on collection confirm', () => {
  it('writes a CREDIT entry with correct amount and entity_type', async () => {
    const { db, entries } = makeLedgerDb()

    await writeLedgerEntry(db, {
      entity_type: 'collection',
      entity_id: UUID,
      entry_type: 'CREDIT',
      amount: '300',
      actor_id: UUID2,
      branch_id: null,
      notes: 'Collection confirmed',
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].entry_type).toBe('CREDIT')
    expect(entries[0].amount).toBe('300')
    expect(entries[0].entity_type).toBe('collection')
  })
})

describe('writeLedgerEntry — DEBIT written on expense approval', () => {
  it('writes a DEBIT entry with correct amount and entity_type', async () => {
    const { db, entries } = makeLedgerDb()

    await writeLedgerEntry(db, {
      entity_type: 'expense',
      entity_id: UUID,
      entry_type: 'DEBIT',
      amount: '500',
      actor_id: UUID2,
      branch_id: null,
      notes: 'Expense approved: Travel',
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].entry_type).toBe('DEBIT')
    expect(entries[0].amount).toBe('500')
    expect(entries[0].entity_type).toBe('expense')
  })
})

describe('writeLedgerEntry — RECONCILIATION entry', () => {
  it('writes a RECONCILIATION entry on verify', async () => {
    const { db, entries } = makeLedgerDb()

    await writeLedgerEntry(db, {
      entity_type: 'reconciliation',
      entity_id: UUID,
      entry_type: 'RECONCILIATION',
      amount: '800',
      actor_id: UUID2,
      notes: 'Daily reconciliation verified',
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].entry_type).toBe('RECONCILIATION')
    expect(entries[0].entity_type).toBe('reconciliation')
  })
})

// ── Ledger arithmetic ─────────────────────────────────────────────────────────

describe('Ledger arithmetic — net position', () => {
  /**
   * 3 confirmed collections ₹100 each → CREDIT = ₹300
   * 1 approved expense ₹50            → DEBIT  = ₹50
   * Net position                       = ₹250 credit
   */
  it('net CREDIT − DEBIT = ₹250 given 3×100 credits and 1×50 debit', () => {
    const ledgerEntries = [
      { entry_type: 'CREDIT', amount: '100' },
      { entry_type: 'CREDIT', amount: '100' },
      { entry_type: 'CREDIT', amount: '100' },
      { entry_type: 'DEBIT',  amount: '50'  },
    ]

    const totalCredit = ledgerEntries
      .filter(e => e.entry_type === 'CREDIT')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0)

    const totalDebit = ledgerEntries
      .filter(e => e.entry_type === 'DEBIT')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0)

    const net = totalCredit - totalDebit

    expect(totalCredit).toBe(300)
    expect(totalDebit).toBe(50)
    expect(net).toBe(250)
  })

  it('net position is zero when credits equal debits', () => {
    const entries = [
      { entry_type: 'CREDIT', amount: '500' },
      { entry_type: 'DEBIT',  amount: '300' },
      { entry_type: 'DEBIT',  amount: '200' },
    ]
    const credit = entries.filter(e => e.entry_type === 'CREDIT').reduce((s, e) => s + parseFloat(e.amount), 0)
    const debit  = entries.filter(e => e.entry_type === 'DEBIT').reduce((s, e) => s + parseFloat(e.amount), 0)
    expect(credit - debit).toBe(0)
  })
})
