/**
 * Real-service tests for createExpense and approveExpense.
 * DB is mocked — no live Postgres required.
 */
import { describe, it, expect } from 'bun:test'
import { createExpense, approveExpense } from '@/lib/modules/expenses/service'
import { ServiceError } from '@/lib/modules/errors'

const UUID  = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

/** Chainable select mock resolving to given rows. */
function selectChain(rows: unknown[]) {
  const c: Record<string, unknown> = {}
  ;['from', 'where', 'limit', 'leftJoin', 'orderBy'].forEach(m => { c[m] = () => c })
  c.then = (fn: (r: unknown[]) => unknown) => Promise.resolve(fn(rows))
  return c
}

const STUB_EXPENSE = {
  id: UUID,
  category_id: UUID2,
  employee_id: UUID,
  branch_id: null,
  amount: '200',
  payment_mode: 'CASH',
  description: 'Travel',
  expense_date: '2026-08-01',
  status: 'PENDING',
}

// ── createExpense ─────────────────────────────────────────────────────────────

describe('createExpense — category not found', () => {
  it('throws 404 when category does not exist', async () => {
    const db = {
      select: () => selectChain([]), // category lookup returns empty
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([STUB_EXPENSE]) }) }),
    } as any

    try {
      await createExpense(db, {
        userId: UUID, branchId: null, actorName: 'Employee', actorEmail: 'e@test.com',
        categoryId: UUID2, amount: 200, description: 'Travel', expenseDate: '2026-08-01',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(404)
      expect(e.message).toContain('category')
    }
  })
})

describe('createExpense — category exists', () => {
  it('creates expense with PENDING status', async () => {
    let insertCallCount = 0
    const db = {
      select: () => selectChain([{ id: UUID2 }]), // category found
      insert: () => {
        insertCallCount++
        const chain: any = { returning: () => Promise.resolve([STUB_EXPENSE]) }; chain.onConflictDoNothing = () => chain; return { values: () => chain }
      },
    } as any

    const result = await createExpense(db, {
      userId: UUID, branchId: null, actorName: 'Employee', actorEmail: 'e@test.com',
      categoryId: UUID2, amount: 200, description: 'Travel', expenseDate: '2026-08-01',
    })

    expect((result as any).status).toBe('PENDING')
    expect((result as any).amount).toBe('200')
  })
})

// ── approveExpense ────────────────────────────────────────────────────────────

describe('approveExpense — expense not found', () => {
  it('throws 404', async () => {
    const db = {
      select: () => selectChain([]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: null,
        actorName: 'Admin', actorEmail: 'admin@test.com', action: 'APPROVED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(404)
    }
  })
})

describe('approveExpense — expense not PENDING', () => {
  it('throws 400 when expense is APPROVED', async () => {
    const db = {
      select: () => selectChain([{ ...STUB_EXPENSE, status: 'APPROVED' }]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: null,
        actorName: 'Admin', actorEmail: 'admin@test.com', action: 'APPROVED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('PENDING')
    }
  })

  it('throws 400 when expense is REJECTED', async () => {
    const db = {
      select: () => selectChain([{ ...STUB_EXPENSE, status: 'REJECTED' }]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: null,
        actorName: 'Admin', actorEmail: 'admin@test.com', action: 'REJECTED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
    }
  })
})

describe('approveExpense — branch isolation', () => {
  it('throws 404 when adminBranchId does not match expense branch_id', async () => {
    const expense = { ...STUB_EXPENSE, branch_id: 'branch-A' }
    const db = {
      select: () => selectChain([expense]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: 'branch-B',
        actorName: 'Admin', actorEmail: 'admin@test.com', action: 'APPROVED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(404)
    }
  })
})

describe('approveExpense — approval writes DEBIT ledger entry', () => {
  it('sets status APPROVED and writes ledger insert', async () => {
    let insertCallCount = 0
    const approved = { ...STUB_EXPENSE, status: 'APPROVED' }

    const txMock = {
      update: () => ({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([approved]) }) }),
      }),
      insert: () => {
        insertCallCount++
        return { values: () => ({ returning: () => Promise.resolve([{ id: 'x' }]) }) }
      },
    }

    const db = {
      select: () => selectChain([STUB_EXPENSE]),
      transaction: async (fn: Function) => fn(txMock),
    } as any

    const result = await approveExpense(db, {
      expenseId: UUID, adminId: UUID2, adminBranchId: null,
      actorName: 'Admin', actorEmail: 'admin@test.com', action: 'APPROVED',
    })

    expect((result as any).status).toBe('APPROVED')
    // audit insert (1) + ledger insert (2)
    expect(insertCallCount).toBeGreaterThanOrEqual(2)
  })
})

describe('approveExpense — rejection does NOT write ledger entry', () => {
  it('sets status REJECTED with reason, only 1 insert (audit log)', async () => {
    let insertCallCount = 0
    const rejected = { ...STUB_EXPENSE, status: 'REJECTED', rejection_reason: 'No receipt' }

    const txMock = {
      update: () => ({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([rejected]) }) }),
      }),
      insert: () => {
        insertCallCount++
        return { values: () => ({ returning: () => Promise.resolve([{}]) }) }
      },
    }

    const db = {
      select: () => selectChain([STUB_EXPENSE]),
      transaction: async (fn: Function) => fn(txMock),
    } as any

    const result = await approveExpense(db, {
      expenseId: UUID, adminId: UUID2, adminBranchId: null,
      actorName: 'Admin', actorEmail: 'admin@test.com', action: 'REJECTED', reason: 'No receipt',
    })

    expect((result as any).status).toBe('REJECTED')
    expect(insertCallCount).toBe(1) // audit only, no ledger
  })
})
