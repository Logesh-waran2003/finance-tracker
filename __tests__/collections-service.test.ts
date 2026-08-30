/**
 * Real-service tests for createCollection.
 * Imports the actual service function and mocks the DB layer.
 */
import { describe, it, expect } from 'bun:test'
import { createCollection } from '@/lib/modules/collections/service'
import { ServiceError } from '@/lib/modules/errors'

const UUID  = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

const BASE_PARAMS = {
  agentId: UUID,
  branchId: null,
  actorName: 'Agent',
  actorEmail: 'agent@test.com',
  customerId: UUID2,
  paymentMode: 'CASH' as const,
}

const STUB_COLLECTION = {
  id: UUID,
  collection_number: 'COL-001',
  amount: '100',
  payment_mode: 'CASH',
  status: 'PENDING',
  idempotency_key: null,
}

/** Build the tx-level mock used by createCollection's db.transaction() call. */
function makeTx(due: Record<string, unknown> | null, insertRows: unknown[] = [STUB_COLLECTION]) {
  return {
    execute: () => Promise.resolve(due ? [due] : []),
    select: () => {
      const c: Record<string, unknown> = {}
      ;['from', 'where', 'limit'].forEach(m => { c[m] = () => c })
      c.then = (fn: (r: unknown[]) => unknown) => Promise.resolve(fn([]))
      return c
    },
    insert: () => {
      const chain: Record<string, unknown> = {
        returning: () => Promise.resolve(insertRows),
      }
      chain.onConflictDoNothing = () => chain
      return { values: () => chain }
    },
  }
}

function makeDb(due: Record<string, unknown> | null, insertRows?: unknown[]) {
  const tx = makeTx(due, insertRows)
  return { transaction: async (fn: Function) => fn(tx) } as any
}

// ── due-linked validation ─────────────────────────────────────────────────────

describe('createCollection — amount > outstanding throws 400', () => {
  it('rejects when amount exceeds outstanding', async () => {
    const db = makeDb({ id: UUID, customer_id: UUID2, outstanding_amount: '100.00', status: 'OPEN' })

    try {
      await createCollection(db, { ...BASE_PARAMS, dueId: UUID, amount: 150 })
      expect(true).toBe(false) // unreachable
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('exceeds outstanding balance')
    }
  })
})

describe('createCollection — amount <= outstanding succeeds', () => {
  it('creates collection with PENDING status', async () => {
    const db = makeDb({ id: UUID, customer_id: UUID2, outstanding_amount: '500.00', status: 'OPEN' })
    const result = await createCollection(db, { ...BASE_PARAMS, dueId: UUID, amount: 500 })
    expect(result.created).toBe(true)
    expect(result.collection).toBeDefined()
    expect((result.collection as any).status).toBe('PENDING')
  })
})

describe('createCollection — idempotency conflict returns existing', () => {
  it('returns created:false and existing record when conflict', async () => {
    const existing = { ...STUB_COLLECTION, idempotency_key: 'idem-key-1' }
    const tx = {
      execute: () => Promise.resolve([]),
      insert: () => {
        const chain: Record<string, unknown> = {
          returning: () => Promise.resolve([]), // conflict → empty
        }
        chain.onConflictDoNothing = () => chain
        return { values: () => chain }
      },
      select: () => {
        const c: Record<string, unknown> = {}
        ;['from', 'where', 'limit'].forEach(m => { c[m] = () => c })
        c.then = (fn: (r: unknown[]) => unknown) => Promise.resolve(fn([existing]))
        return c
      },
    }
    const db = { transaction: async (fn: Function) => fn(tx) } as any

    const result = await createCollection(db, {
      ...BASE_PARAMS, amount: 100, idempotencyKey: 'idem-key-1',
    })
    expect(result.created).toBe(false)
    expect((result.collection as any).id).toBe(UUID)
  })
})

describe('createCollection — terminal due statuses', () => {
  it('throws 400 on PAID due', async () => {
    const db = makeDb({ id: UUID, customer_id: UUID2, outstanding_amount: '0', status: 'PAID' })
    try {
      await createCollection(db, { ...BASE_PARAMS, dueId: UUID, amount: 100 })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('PAID')
    }
  })

  it('throws 400 on CANCELLED due', async () => {
    const db = makeDb({ id: UUID, customer_id: UUID2, outstanding_amount: '500', status: 'CANCELLED' })
    try {
      await createCollection(db, { ...BASE_PARAMS, dueId: UUID, amount: 100 })
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e instanceof ServiceError).toBe(true)
      expect(e.status).toBe(400)
      expect(e.message).toContain('CANCELLED')
    }
  })
})

describe('createCollection — freeform (no dueId)', () => {
  it('skips due validation entirely and creates collection', async () => {
    const db = makeDb(null) // execute never called for due check
    const result = await createCollection(db, { ...BASE_PARAMS, amount: 250 })
    expect(result.created).toBe(true)
  })
})
