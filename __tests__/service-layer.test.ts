/**
 * Service-layer unit tests — business logic for collections, expenses,
 * reconciliation, and attendance.
 *
 * DB calls are mocked via lightweight object builders. No live DB required.
 * Auth is a route concern — service tests assume the caller already verified
 * access (documented where relevant).
 *
 * Run: bun run test
 */
import { describe, it, expect, beforeEach } from 'bun:test'

// ── Shared helpers ────────────────────────────────────────────────────────────

const UUID = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

/** Build a chainable select mock that resolves to the given rows. */
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  ;['from', 'where', 'limit', 'leftJoin', 'orderBy'].forEach(m => {
    chain[m] = () => chain
  })
  chain.then = (fn: (r: unknown[]) => unknown) => Promise.resolve(fn(rows))
  return chain
}

/** Build a minimal insert mock that returns the given rows.
 * Supports the full Drizzle insert chain: .values().onConflictDoNothing().returning()
 */
function insertReturning(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    returning: () => Promise.resolve(rows),
  }
  chain.onConflictDoNothing = () => chain
  return {
    insert: () => ({
      values: () => chain,
    }),
  }
}

// ── ServiceError ──────────────────────────────────────────────────────────────

describe('ServiceError', () => {
  it('carries message and HTTP status', async () => {
    const { ServiceError } = await import('@/lib/modules/errors')
    const err = new ServiceError('Due not found', 404)
    expect(err.message).toBe('Due not found')
    expect(err.status).toBe(404)
    expect(err.name).toBe('ServiceError')
    expect(err instanceof Error).toBe(true)
  })

  it('is instanceof ServiceError', async () => {
    const { ServiceError } = await import('@/lib/modules/errors')
    const err = new ServiceError('test', 400)
    expect(err instanceof ServiceError).toBe(true)
  })
})

// ── createCollection ──────────────────────────────────────────────────────────

describe('createCollection — idempotency', () => {
  it('returns existing record when idempotency_key already exists (no new insert)', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const existing = { id: UUID, amount: '100', status: 'PENDING', collection_number: 'COL-001' }

    // tx mock: insert returns [] (conflict → onConflictDoNothing swallows it),
    // then select returns the existing record. Service returns created: false.
    const db = {
      transaction: async (fn: Function) => fn({
        select: () => selectChain([existing]),
        insert: () => insertReturning([]).insert(),
        execute: () => Promise.resolve([]),
      }),
    } as any

    const result = await createCollection(db, {
      agentId: UUID, branchId: null, actorName: 'Agent', actorEmail: 'a@b.com',
      customerId: UUID2, amount: 100, paymentMode: 'CASH', idempotencyKey: 'key-abc',
    })

    expect(result.created).toBe(false)
    expect((result.collection as any).id).toBe(UUID)
  })
})

describe('createCollection — due validation', () => {
  // Helper: build a db mock where the tx's execute() returns the given due row
  function makeDB(due: Record<string, unknown> | null, insertResult = [{ id: UUID, collection_number: 'COL-001', amount: '100', payment_mode: 'CASH', status: 'PENDING' }]) {
    return {
      transaction: async (fn: Function) => fn({
        // idempotency select → no existing record
        select: () => selectChain([]),
        // FOR UPDATE execute → return due row (or empty for not found)
        execute: () => Promise.resolve(due ? [due] : []),
        // insert collections + audit_logs (supports .onConflictDoNothing().returning())
        insert: () => {
          const chain: Record<string, unknown> = { returning: () => Promise.resolve(insertResult) }
          chain.onConflictDoNothing = () => chain
          return { values: () => chain }
        },
      }),
    } as any
  }

  it('throws 404 when due_id is provided but due does not exist', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const { ServiceError } = await import('@/lib/modules/errors')
    const db = makeDB(null)

    await expect(
      createCollection(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        customerId: UUID2, dueId: UUID, amount: 100, paymentMode: 'CASH',
      })
    ).rejects.toThrow(ServiceError)

    try {
      await createCollection(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        customerId: UUID2, dueId: UUID, amount: 100, paymentMode: 'CASH',
      })
    } catch (e: any) {
      expect(e.status).toBe(404)
      expect(e.message).toBe('Due not found')
    }
  })

  it('throws 400 when due belongs to a different customer', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const { ServiceError } = await import('@/lib/modules/errors')
    const db = makeDB({
      id: UUID, customer_id: 'different-customer-uuid', outstanding_amount: '500', status: 'OPEN',
    })

    try {
      await createCollection(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        customerId: UUID2, dueId: UUID, amount: 100, paymentMode: 'CASH',
      })
      expect(true).toBe(false) // should not reach
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
    }
  })

  it('throws 400 when due status is PAID', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const { ServiceError } = await import('@/lib/modules/errors')
    const db = makeDB({
      id: UUID, customer_id: UUID2, outstanding_amount: '0', status: 'PAID',
    })

    try {
      await createCollection(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        customerId: UUID2, dueId: UUID, amount: 100, paymentMode: 'CASH',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('PAID')
    }
  })

  it('throws 400 when due status is CANCELLED', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const { ServiceError } = await import('@/lib/modules/errors')
    const db = makeDB({
      id: UUID, customer_id: UUID2, outstanding_amount: '500', status: 'CANCELLED',
    })

    try {
      await createCollection(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        customerId: UUID2, dueId: UUID, amount: 100, paymentMode: 'CASH',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('CANCELLED')
    }
  })

  it('throws 400 when amount exceeds outstanding balance', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const { ServiceError } = await import('@/lib/modules/errors')
    const db = makeDB({
      id: UUID, customer_id: UUID2, outstanding_amount: '300', status: 'OPEN',
    })

    try {
      await createCollection(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        customerId: UUID2, dueId: UUID, amount: 500, paymentMode: 'CASH',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('exceeds outstanding balance')
    }
  })

  it('succeeds when amount equals outstanding balance (full payment)', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const db = makeDB({ id: UUID, customer_id: UUID2, outstanding_amount: '500', status: 'OPEN' })

    const result = await createCollection(db, {
      agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
      customerId: UUID2, dueId: UUID, amount: 500, paymentMode: 'CASH',
    })

    expect(result.created).toBe(true)
    expect(result.collection).toBeDefined()
  })

  it('succeeds when amount is less than outstanding (partial payment)', async () => {
    const { createCollection } = await import('@/lib/modules/collections/service')
    const db = makeDB({ id: UUID, customer_id: UUID2, outstanding_amount: '500', status: 'OPEN' })

    const result = await createCollection(db, {
      agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
      customerId: UUID2, dueId: UUID, amount: 100, paymentMode: 'CASH',
    })

    expect(result.created).toBe(true)
  })
})

describe('createCollection — agent assignment (route concern)', () => {
  /**
   * Agent-to-customer assignment is enforced by requireCustomerAccess() in the route,
   * before createCollection is called. The service trusts the caller.
   * Verified by: app/api/collections/route.ts → requireCustomerAccess → accessErr check.
   */
  it('documents that agent-customer verification is a route-layer concern', () => {
    // requireCustomerAccess is called in route.ts before createCollection.
    // If the agent is not assigned, a 403 NextResponse is returned before the service runs.
    // This is the correct separation: auth checks stay in routes, business logic in services.
    expect(true).toBe(true)
  })
})

// ── approveExpense ────────────────────────────────────────────────────────────

describe('approveExpense', () => {
  it('throws 404 when expense does not exist', async () => {
    const { approveExpense } = await import('@/lib/modules/expenses/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const db = {
      select: () => selectChain([]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: null,
        actorName: 'Admin', actorEmail: 'admin@b.com',
        action: 'APPROVED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(404)
    }
  })

  it('throws 400 when expense is already APPROVED', async () => {
    const { approveExpense } = await import('@/lib/modules/expenses/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const expense = { id: UUID, status: 'APPROVED', amount: '200', description: 'Travel', branch_id: null }
    const db = {
      select: () => selectChain([expense]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: null,
        actorName: 'Admin', actorEmail: 'admin@b.com',
        action: 'APPROVED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('PENDING')
    }
  })

  it('throws 400 when expense is already REJECTED', async () => {
    const { approveExpense } = await import('@/lib/modules/expenses/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const expense = { id: UUID, status: 'REJECTED', amount: '200', description: 'Travel', branch_id: null }
    const db = {
      select: () => selectChain([expense]),
      transaction: async (fn: Function) => fn({}),
    } as any

    try {
      await approveExpense(db, {
        expenseId: UUID, adminId: UUID2, adminBranchId: null,
        actorName: 'Admin', actorEmail: 'admin@b.com',
        action: 'REJECTED',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
    }
  })

  it('approves a PENDING expense and writes ledger DEBIT', async () => {
    const { approveExpense } = await import('@/lib/modules/expenses/service')

    const expense = { id: UUID, status: 'PENDING', amount: '500', description: 'Auto fare', branch_id: null }
    let ledgerInserted = false
    let insertCallCount = 0

    const txMock = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...expense, status: 'APPROVED' }]),
          }),
        }),
      }),
      insert: () => {
        insertCallCount++
        // Second insert is the ledger entry
        if (insertCallCount >= 2) ledgerInserted = true
        return { values: () => ({ returning: () => Promise.resolve([{ id: 'log-id' }]) }) }
      },
    }

    const db = {
      select: () => selectChain([expense]),
      transaction: async (fn: Function) => fn(txMock),
    } as any

    const result = await approveExpense(db, {
      expenseId: UUID, adminId: UUID2, adminBranchId: null,
      actorName: 'Admin', actorEmail: 'admin@b.com',
      action: 'APPROVED',
    })

    expect((result as any).status).toBe('APPROVED')
    expect(ledgerInserted).toBe(true)
  })

  it('rejects a PENDING expense without writing ledger entry', async () => {
    const { approveExpense } = await import('@/lib/modules/expenses/service')

    const expense = { id: UUID, status: 'PENDING', amount: '500', description: 'Auto fare', branch_id: null }
    let insertCallCount = 0

    const txMock = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...expense, status: 'REJECTED', rejection_reason: 'Invalid' }]),
          }),
        }),
      }),
      insert: () => {
        insertCallCount++
        return { values: () => ({ returning: () => Promise.resolve([{}]) }) }
      },
    }

    const db = {
      select: () => selectChain([expense]),
      transaction: async (fn: Function) => fn(txMock),
    } as any

    const result = await approveExpense(db, {
      expenseId: UUID, adminId: UUID2, adminBranchId: null,
      actorName: 'Admin', actorEmail: 'admin@b.com',
      action: 'REJECTED', reason: 'Invalid receipt',
    })

    expect((result as any).status).toBe('REJECTED')
    // Only audit log insert, no ledger entry
    expect(insertCallCount).toBe(1)
  })

  /**
   * Non-admin access is blocked at the route layer by requireAdmin().
   * approveExpense() is only ever reached by an admin.
   * Verified by: app/api/admin/expenses/[id]/route.ts → requireAdmin.
   */
  it('documents that non-admin access is a route-layer concern', () => {
    expect(true).toBe(true)
  })
})

// ── createReconciliation ──────────────────────────────────────────────────────

describe('createReconciliation — server-side cash_collected', () => {
  it('throws 400 for a future date', async () => {
    const { createReconciliation } = await import('@/lib/modules/reconciliation/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    // No DB calls needed — future date check is first
    const db = { select: () => selectChain([]), transaction: async () => ({}) } as any
    const futureDate = new Date(Date.now() + 86400_000).toISOString().split('T')[0]

    try {
      await createReconciliation(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        date: futureDate, cashSubmitted: 500,
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('future')
    }
  })

  it('calculates cash_collected from DB — ignores any client-supplied value', async () => {
    const { createReconciliation } = await import('@/lib/modules/reconciliation/service')

    const today = new Date().toISOString().split('T')[0]

    // DB returns 800 from collections on first select call, 0 from loan_payments on second
    let insertedCashCollected: string | null = null
    const record = { id: UUID, agent_id: UUID, date: today, cash_collected: '800.00', cash_submitted: '500', status: 'PENDING' }
    let selectCall = 0

    const db = {
      select: () => {
        const rows = selectCall === 0 ? [{ total: '800' }] : [{ total: '0' }]
        selectCall++
        return selectChain(rows)
      },
      insert: () => ({ values: () => Promise.resolve() }), // fire-and-forget notifications
      transaction: async (fn: Function) => fn({
        select: () => selectChain([]), // upsert check — no existing record
        insert: () => ({
          values: (vals: any) => {
            if (vals.cash_collected !== undefined) insertedCashCollected = vals.cash_collected
            return { returning: () => Promise.resolve([record]) }
          },
        }),
      }),
    } as any

    await createReconciliation(db, {
      agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
      date: today, cashSubmitted: 500,
    })

    // Service must insert the server-calculated value (800.00), not the client-submitted one (500)
    expect(insertedCashCollected!).toBe('800.00')
  })

  it('uses 0 as cash_collected when agent has no confirmed CASH collections', async () => {
    const { createReconciliation } = await import('@/lib/modules/reconciliation/service')

    const today = new Date().toISOString().split('T')[0]
    let insertedCashCollected: string | null = null

    const db = {
      select: () => selectChain([{ total: null }]), // null → 0 from both queries
      insert: () => ({ values: () => Promise.resolve() }), // fire-and-forget notifications
      transaction: async (fn: Function) => fn({
        select: () => selectChain([]), // upsert check — no existing record
        insert: () => ({
          values: (vals: any) => {
            if (vals.cash_collected !== undefined) insertedCashCollected = vals.cash_collected
            return { returning: () => Promise.resolve([{ id: UUID, date: today, status: 'PENDING' }]) }
          },
        }),
      }),
    } as any

    // cashSubmitted: 0 since collected is also 0 — overpayment guard allows equal amounts
    await createReconciliation(db, {
      agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
      date: today, cashSubmitted: 0,
    })

    expect(insertedCashCollected!).toBe('0.00')
  })

  it('throws 409 (ServiceError) on duplicate agent+date', async () => {
    const { createReconciliation } = await import('@/lib/modules/reconciliation/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const today = new Date().toISOString().split('T')[0]
    let selectCall = 0
    const db = {
      select: () => {
        // First two selects: cash totals (500 + 0). tx.select returns existing PENDING record.
        const rows = selectCall < 2 ? [{ total: '500' }] : []
        selectCall++
        return selectChain(rows)
      },
      transaction: async (fn: Function) => fn({
        select: () => selectChain([{ id: UUID, status: 'SUBMITTED' }]), // existing record, not PENDING
        insert: () => ({
          values: () => ({
            returning: () => { throw Object.assign(new Error('unique violation'), { code: '23505' }) },
          }),
        }),
      }),
    } as any

    try {
      await createReconciliation(db, {
        agentId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        date: today, cashSubmitted: 500,
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(409)
    }
  })
})

// ── checkIn / checkOut ────────────────────────────────────────────────────────

describe('checkIn', () => {
  it('throws 400 when employee already checked in today', async () => {
    const { checkIn } = await import('@/lib/modules/attendance/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const db = {
      select: () => selectChain([{ id: UUID, check_in_at: new Date(), check_out_at: null }]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([{}]) }) }) }),
    } as any

    try {
      await checkIn(db, { userId: UUID, branchId: null })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toBe('Already checked in')
    }
  })

  it('inserts a new attendance record on first check-in', async () => {
    const { checkIn } = await import('@/lib/modules/attendance/service')

    const newRecord = { id: UUID, employee_id: UUID, check_in_at: new Date(), status: 'PRESENT' }
    let insertCalled = false

    const db = {
      select: () => selectChain([]), // no existing record today
      insert: () => {
        insertCalled = true
        return { values: () => ({ returning: () => Promise.resolve([newRecord]) }) }
      },
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([newRecord]) }) }) }),
    } as any

    const result = await checkIn(db, { userId: UUID, branchId: null })
    expect(insertCalled).toBe(true)
    expect((result as any).id).toBe(UUID)
  })

  it('updates existing record if attendance row exists but check_in_at is null', async () => {
    const { checkIn } = await import('@/lib/modules/attendance/service')

    // Row exists (e.g. admin pre-created ABSENT record) but no check-in yet
    const existing = { id: UUID, employee_id: UUID, check_in_at: null, check_out_at: null }
    const updated = { ...existing, check_in_at: new Date(), status: 'PRESENT' }
    let updateCalled = false

    const db = {
      select: () => selectChain([existing]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
      update: () => {
        updateCalled = true
        return { set: () => ({ where: () => ({ returning: () => Promise.resolve([updated]) }) }) }
      },
    } as any

    const result = await checkIn(db, { userId: UUID, branchId: null })
    expect(updateCalled).toBe(true)
    expect((result as any).check_in_at).toBeDefined()
  })

  it('GPS coordinates are optional — check-in succeeds without them', async () => {
    const { checkIn } = await import('@/lib/modules/attendance/service')

    const db = {
      select: () => selectChain([]),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: UUID }]) }) }),
    } as any

    const result = await checkIn(db, { userId: UUID, branchId: null })
    // No gpsLat/gpsLng — should not throw
    expect((result as any).id).toBe(UUID)
  })
})

describe('checkOut', () => {
  it('throws 400 when no check-in record exists for today', async () => {
    const { checkOut } = await import('@/lib/modules/attendance/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const db = {
      select: () => selectChain([]), // no attendance record
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([{}]) }) }) }),
    } as any

    try {
      await checkOut(db, { userId: UUID })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toBe('Not checked in')
    }
  })

  it('throws 400 when check_in_at is null (not checked in yet)', async () => {
    const { checkOut } = await import('@/lib/modules/attendance/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const db = {
      select: () => selectChain([{ id: UUID, check_in_at: null, check_out_at: null }]),
    } as any

    try {
      await checkOut(db, { userId: UUID })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toBe('Not checked in')
    }
  })

  it('throws 400 when employee already checked out', async () => {
    const { checkOut } = await import('@/lib/modules/attendance/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const db = {
      select: () => selectChain([{
        id: UUID,
        check_in_at: new Date(Date.now() - 3_600_000),
        check_out_at: new Date(),
      }]),
    } as any

    try {
      await checkOut(db, { userId: UUID })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toBe('Already checked out')
    }
  })

  it('updates check_out_at on valid checkout', async () => {
    const { checkOut } = await import('@/lib/modules/attendance/service')

    const now = new Date()
    const existing = { id: UUID, check_in_at: new Date(now.getTime() - 3_600_000), check_out_at: null }
    const updated = { ...existing, check_out_at: now }
    let updateCalled = false

    const db = {
      select: () => selectChain([existing]),
      update: () => {
        updateCalled = true
        return { set: () => ({ where: () => ({ returning: () => Promise.resolve([updated]) }) }) }
      },
    } as any

    const result = await checkOut(db, { userId: UUID })
    expect(updateCalled).toBe(true)
    expect((result as any).check_out_at).toBeDefined()
  })
})

// ── createExpense ─────────────────────────────────────────────────────────────

describe('createExpense', () => {
  it('throws 404 when category does not exist', async () => {
    const { createExpense } = await import('@/lib/modules/expenses/service')
    const { ServiceError } = await import('@/lib/modules/errors')

    const db = {
      select: () => selectChain([]), // no category found
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
    } as any

    try {
      await createExpense(db, {
        userId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
        categoryId: UUID2, amount: 100, description: 'Fuel', expenseDate: '2026-08-25',
      })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(404)
      expect(e.message).toBe('Expense category not found')
    }
  })

  it('inserts expense with PENDING status', async () => {
    const { createExpense } = await import('@/lib/modules/expenses/service')

    const newExpense = { id: UUID, status: 'PENDING', amount: '150', description: 'Fuel' }
    let insertValues: any = null

    const db = {
      select: () => selectChain([{ id: UUID2 }]), // category exists
      insert: () => ({
        values: (vals: any) => {
          if (!insertValues) insertValues = vals // capture first insert (expense)
          return { returning: () => Promise.resolve([newExpense]) }
        },
      }),
    } as any

    const result = await createExpense(db, {
      userId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
      categoryId: UUID2, amount: 150, description: 'Fuel', expenseDate: '2026-08-25',
    })

    expect((result as any).status).toBe('PENDING')
    expect(insertValues?.status).toBe('PENDING')
    expect(insertValues?.employee_id).toBe(UUID)
  })

  it('defaults payment_mode to CASH when not provided', async () => {
    const { createExpense } = await import('@/lib/modules/expenses/service')

    let insertValues: any = null
    const db = {
      select: () => selectChain([{ id: UUID2 }]),
      insert: () => ({
        values: (vals: any) => {
          if (!insertValues) insertValues = vals
          return { returning: () => Promise.resolve([{ id: UUID, status: 'PENDING' }]) }
        },
      }),
    } as any

    await createExpense(db, {
      userId: UUID, branchId: null, actorName: 'A', actorEmail: 'a@b.com',
      categoryId: UUID2, amount: 100, description: 'Misc', expenseDate: '2026-08-25',
    })

    expect(insertValues?.payment_mode).toBe('CASH')
  })
})
