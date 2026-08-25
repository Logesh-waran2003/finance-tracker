// Manual mock for next/server — used in vitest environment only
// Provides NextResponse compatible with test assertions

class MockNextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    return new MockNextResponse(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    })
  }

  static redirect(url: string, status = 307) {
    return new MockNextResponse(null, { status, headers: { Location: url } })
  }

  static rewrite(url: string) {
    return new MockNextResponse(null, { headers: { 'x-middleware-rewrite': url } })
  }

  static next() {
    return new MockNextResponse(null)
  }
}

class MockNextRequest extends Request {
  get nextUrl() {
    return new URL(this.url)
  }
}

export const NextResponse = MockNextResponse
export const NextRequest = MockNextRequest
export function userAgent() { return {} }
