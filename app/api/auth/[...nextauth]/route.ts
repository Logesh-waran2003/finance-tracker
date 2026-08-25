import { handlers } from '@/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// GET handles OAuth callbacks — no rate limit needed
export const GET = handlers.GET

// POST handles credential login — rate-limit to 10 attempts per 15 min per IP
export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ nextauth: string[] }> }
) {
  const ip = getClientIp(request)
  const result = checkRateLimit(ip, { windowMs: 15 * 60 * 1000, max: 10, blockMs: 15 * 60 * 1000 })

  if (result.limited) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Reset': String(Date.now() + result.retryAfterMs),
        },
      }
    )
  }

  return handlers.POST(request)
}
