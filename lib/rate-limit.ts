/**
 * Simple in-memory rate limiter for auth routes.
 *
 * Keyed by IP address. Uses a sliding window: each bucket records
 * request timestamps. Requests older than `windowMs` are pruned on
 * each check. If the bucket size exceeds `max` after pruning, the
 * request is rejected with a 429.
 *
 * Note: this is per-process. In a multi-instance deployment use Redis
 * (e.g. @upstash/ratelimit) instead.
 */

interface Bucket {
  timestamps: number[]
  blocked_until?: number
}

const store = new Map<string, Bucket>()

// Clean up old keys every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000
  for (const [key, bucket] of store.entries()) {
    bucket.timestamps = bucket.timestamps.filter(t => t > cutoff)
    if (bucket.timestamps.length === 0 && !bucket.blocked_until) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000).unref?.()

export interface RateLimitOptions {
  /** Window size in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number
  /** Maximum requests per window per IP (default: 10) */
  max?: number
  /** Block duration in ms after limit exceeded (default: 15 minutes) */
  blockMs?: number
}

/**
 * Check whether the given IP is rate-limited.
 * Returns { limited: false } if OK, or { limited: true, retryAfterMs } if blocked.
 */
export function checkRateLimit(
  ip: string,
  options: RateLimitOptions = {}
): { limited: false } | { limited: true; retryAfterMs: number } {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 10
  const blockMs = options.blockMs ?? 15 * 60 * 1000

  const now = Date.now()
  let bucket = store.get(ip)

  if (!bucket) {
    bucket = { timestamps: [] }
    store.set(ip, bucket)
  }

  // Check hard block first
  if (bucket.blocked_until && now < bucket.blocked_until) {
    return { limited: true, retryAfterMs: bucket.blocked_until - now }
  }
  if (bucket.blocked_until && now >= bucket.blocked_until) {
    bucket.blocked_until = undefined
    bucket.timestamps = []
  }

  // Slide the window
  const windowStart = now - windowMs
  bucket.timestamps = bucket.timestamps.filter(t => t > windowStart)

  if (bucket.timestamps.length >= max) {
    bucket.blocked_until = now + blockMs
    return { limited: true, retryAfterMs: blockMs }
  }

  bucket.timestamps.push(now)
  return { limited: false }
}

/**
 * Extract the client IP from a Next.js Request object.
 *
 * This app runs without a reverse proxy (bun run dev / bun run start directly),
 * so X-Forwarded-For and X-Real-IP headers are fully attacker-controlled and
 * cannot be trusted. Next.js Request does not expose the raw TCP connection IP,
 * so we return 'unknown' and let all same-machine requests share one rate-limit
 * bucket — acceptable for dev/LAN deployments.
 *
 * If you add a trusted reverse proxy in the future, re-enable header parsing
 * only after configuring the proxy's trusted-IP list.
 */
export function getClientIp(_request: Request): string {
  return 'unknown'
}
