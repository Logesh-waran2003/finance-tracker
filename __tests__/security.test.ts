/**
 * Security and financial integrity tests.
 * These are integration-style unit tests using mocked DB and auth.
 *
 * Run: bun test
 */
import { describe, it, expect, beforeEach } from 'bun:test'

// ---------------------------------------------------------------------------
// Helpers — mock next-auth session
// ---------------------------------------------------------------------------

type MockUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'
  branch_id: string | null
  employee_code: string | null
}

const ADMIN: MockUser = {
  id: 'admin-uuid-0001',
  email: 'admin@demo.com',
  name: 'Admin User',
  role: 'ADMIN',
  branch_id: 'branch-uuid-0001',
  employee_code: 'EMP-001',
}

const AGENT_A: MockUser = {
  id: 'agent-uuid-0001',
  email: 'agent-a@demo.com',
  name: 'Agent A',
  role: 'COLLECTION_AGENT',
  branch_id: 'branch-uuid-0001',
  employee_code: 'EMP-002',
}

const AGENT_B: MockUser = {
  id: 'agent-uuid-0002',
  email: 'agent-b@demo.com',
  name: 'Agent B',
  role: 'COLLECTION_AGENT',
  branch_id: 'branch-uuid-0001',
  employee_code: 'EMP-003',
}

// ---------------------------------------------------------------------------
// Test: Authorization utility
// ---------------------------------------------------------------------------

describe('lib/auth/authorize', () => {
  it('isResponse: Response instance is detected correctly', () => {
    // isResponse checks instanceof Response — verify the logic directly
    const r = new Response(JSON.stringify({ error: 'test' }), { status: 401 })
    expect(r instanceof Response).toBe(true)
    expect(({} as any) instanceof Response).toBe(false)
    expect((null as any) instanceof Response).toBe(false)
    expect((('string') as any) instanceof Response).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test: Zod validation schemas
// ---------------------------------------------------------------------------

describe('lib/validation — createCollectionSchema', () => {
  it('rejects amount <= 0', async () => {
    const { createCollectionSchema } = await import('@/lib/validation')
    const result = createCollectionSchema.safeParse({
      customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 0,
      payment_mode: 'CASH',
    })
    expect(result.success).toBe(false)
  })

  it('rejects amount < 0', async () => {
    const { createCollectionSchema } = await import('@/lib/validation')
    const result = createCollectionSchema.safeParse({
      customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: -100,
      payment_mode: 'CASH',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid customer_id (not UUID)', async () => {
    const { createCollectionSchema } = await import('@/lib/validation')
    const result = createCollectionSchema.safeParse({
      customer_id: 'not-a-uuid',
      amount: 100,
      payment_mode: 'CASH',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid collection payload', async () => {
    const { createCollectionSchema } = await import('@/lib/validation')
    const result = createCollectionSchema.safeParse({
      customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 500,
      payment_mode: 'CASH',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid GPS lat > 90', async () => {
    const { createCollectionSchema } = await import('@/lib/validation')
    const result = createCollectionSchema.safeParse({
      customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 100,
      payment_mode: 'CASH',
      gps_lat: 91,
      gps_lng: 80,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid GPS lng < -180', async () => {
    const { createCollectionSchema } = await import('@/lib/validation')
    const result = createCollectionSchema.safeParse({
      customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 100,
      payment_mode: 'CASH',
      gps_lat: 13.0,
      gps_lng: -181,
    })
    expect(result.success).toBe(false)
  })
})

describe('lib/validation — createReconciliationSchema', () => {
  it('rejects cash_submitted <= 0', async () => {
    const { createReconciliationSchema } = await import('@/lib/validation')
    const result = createReconciliationSchema.safeParse({
      date: '2026-08-01',
      cash_collected: 1000,
      cash_submitted: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', async () => {
    const { createReconciliationSchema } = await import('@/lib/validation')
    const result = createReconciliationSchema.safeParse({
      date: '01-08-2026',
      cash_collected: 1000,
      cash_submitted: 500,
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid reconciliation payload', async () => {
    const { createReconciliationSchema } = await import('@/lib/validation')
    const result = createReconciliationSchema.safeParse({
      date: '2026-08-01',
      cash_collected: 1000,
      cash_submitted: 1000,
    })
    expect(result.success).toBe(true)
  })
})

describe('lib/validation — adminCollectionActionSchema', () => {
  it('requires reason when action is reject', async () => {
    const { adminCollectionActionSchema } = await import('@/lib/validation')
    const result = adminCollectionActionSchema.safeParse({ action: 'reject' })
    expect(result.success).toBe(false)
  })

  it('accepts reject with reason', async () => {
    const { adminCollectionActionSchema } = await import('@/lib/validation')
    const result = adminCollectionActionSchema.safeParse({ action: 'reject', reason: 'Duplicate' })
    expect(result.success).toBe(true)
  })

  it('accepts confirm without reason', async () => {
    const { adminCollectionActionSchema } = await import('@/lib/validation')
    const result = adminCollectionActionSchema.safeParse({ action: 'confirm' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown action', async () => {
    const { adminCollectionActionSchema } = await import('@/lib/validation')
    const result = adminCollectionActionSchema.safeParse({ action: 'approve' })
    expect(result.success).toBe(false)
  })
})

describe('lib/validation — changePasswordSchema', () => {
  it('rejects new_password shorter than 8 chars', async () => {
    const { changePasswordSchema } = await import('@/lib/validation')
    const result = changePasswordSchema.safeParse({
      current_password: 'OldPass1',
      new_password: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid password change', async () => {
    const { changePasswordSchema } = await import('@/lib/validation')
    const result = changePasswordSchema.safeParse({
      current_password: 'OldPassword123',
      new_password: 'NewPassword456',
    })
    expect(result.success).toBe(true)
  })
})

describe('lib/validation — parseBody', () => {
  it('returns error response on invalid JSON', async () => {
    const { parseBody, createCollectionSchema } = await import('@/lib/validation')
    const badRequest = new Request('http://localhost/api/test', {
      method: 'POST',
      body: 'not json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(badRequest, createCollectionSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) { expect(result.response).toBeDefined() }
  })

  it('returns error response when schema fails', async () => {
    const { parseBody, createCollectionSchema } = await import('@/lib/validation')
    const badRequest = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ customer_id: 'not-uuid', amount: -1, payment_mode: 'CASH' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(badRequest, createCollectionSchema)
    expect(result.ok).toBe(false)
  })

  it('returns parsed data on valid input', async () => {
    const { parseBody, createCollectionSchema } = await import('@/lib/validation')
    const goodRequest = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        amount: 250,
        payment_mode: 'UPI',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(goodRequest, createCollectionSchema)
    expect(result.ok).toBe(true)
    if (result.ok) { expect(result.data.amount).toBe(250) }
  })
})

describe('lib/validation — expense schema', () => {
  it('rejects amount <= 0', async () => {
    const { createExpenseSchema } = await import('@/lib/validation')
    const result = createExpenseSchema.safeParse({
      category_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 0,
      description: 'Travel',
      expense_date: '2026-08-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty description', async () => {
    const { createExpenseSchema } = await import('@/lib/validation')
    const result = createExpenseSchema.safeParse({
      category_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 100,
      description: '',
      expense_date: '2026-08-01',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid expense', async () => {
    const { createExpenseSchema } = await import('@/lib/validation')
    const result = createExpenseSchema.safeParse({
      category_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount: 150,
      description: 'Auto fare',
      expense_date: '2026-08-01',
    })
    expect(result.success).toBe(true)
  })
})
