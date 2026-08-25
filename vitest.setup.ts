// Vitest global setup — provides minimum env vars required for module imports
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long-here'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Mock next/server so NextResponse is available without a running Next.js server
class MockNextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    return new MockNextResponse(JSON.stringify(body), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  }
}

// Make the mock available globally so imports of NextResponse work
;(globalThis as any).NextResponse = MockNextResponse
