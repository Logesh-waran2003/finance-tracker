import { test, expect, describe } from 'bun:test'
import { approveExpense } from '../lib/modules/expenses/service'
import { checkRateLimit, getClientIp } from '../lib/rate-limit'
import { ServiceError } from '../lib/modules/errors'

describe('security', () => {
  // ──────────────────────────────────────────────────────────────
  // Fix 1 — Expense IDOR: branch isolation
  // ──────────────────────────────────────────────────────────────
  describe('Fix 1 — Expense IDOR: branch isolation', () => {
    test('branch-scoped admin cannot approve an expense from another branch', async () => {
      // Mock db: returns an expense belonging to branch-B
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: 'exp-1',
                    branch_id: 'branch-B',
                    status: 'PENDING',
                    amount: '100',
                    description: 'Test expense',
                  },
                ]),
            }),
          }),
        }),
        insert: () => ({}),
        update: () => ({}),
        transaction: () => ({}),
      }

      let caughtErr: unknown
      try {
        await approveExpense(mockDb as any, {
          expenseId: 'exp-1',
          adminId: 'admin-1',
          adminBranchId: 'branch-A', // scoped to branch-A, not branch-B
          actorName: 'Admin User',
          actorEmail: 'admin@test.com',
          action: 'APPROVED',
        })
      } catch (err) {
        caughtErr = err
      }

      expect(caughtErr).toBeInstanceOf(ServiceError)
      expect((caughtErr as ServiceError).message).toBe('Expense not found')
      expect((caughtErr as ServiceError).status).toBe(404)
    })
  })

  // ──────────────────────────────────────────────────────────────
  // Fix 2 — Rate limiter: spoofed X-Forwarded-For is ignored
  // ──────────────────────────────────────────────────────────────
  describe('Fix 2 — Rate limiter: no X-Forwarded-For trust', () => {
    test('getClientIp always returns "unknown" regardless of headers', () => {
      // Spoofed headers must not influence the result
      const reqWithSpoofedHeaders = new Request('http://localhost/', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '5.6.7.8',
        },
      })
      expect(getClientIp(reqWithSpoofedHeaders)).toBe('unknown')

      // No headers — still unknown
      const reqClean = new Request('http://localhost/')
      expect(getClientIp(reqClean)).toBe('unknown')
    })

    test('rate limiter triggers on the 11th request when max is 10', () => {
      // Use a timestamp-suffixed key so repeated test runs start with a clean bucket
      const ip = `test-ip-unique-${Date.now()}`

      let result: ReturnType<typeof checkRateLimit> = { limited: false }
      for (let i = 0; i < 11; i++) {
        result = checkRateLimit(ip, { max: 10 })
      }

      // The 11th call should be rate-limited
      expect(result.limited).toBe(true)
      if (result.limited) {
        expect(result.retryAfterMs).toBeGreaterThan(0)
      }
    })
  })
})
