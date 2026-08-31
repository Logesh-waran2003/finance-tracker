/**
 * Global test setup — preloaded by `bun test` via bunfig.toml.
 *
 * Purpose: make the test run hermetic. `lib/env.ts` throws at import time when
 * DATABASE_URL / NEXTAUTH_SECRET / NEXTAUTH_URL are missing. That fail-fast is
 * correct and protects production, so we give the tests real (dummy) values
 * instead of weakening the check.
 *
 * Values come from `.env.test`. Bun loads that file automatically when
 * NODE_ENV=test, but we re-apply defaults here so a stray NODE_ENV or a missing
 * .env.test cannot break the suite.
 *
 * Ported from the deleted vitest.setup.ts.
 */

const defaults: Record<string, string> = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/finance_tracker_test',
  NEXTAUTH_SECRET: 'test-secret-at-least-32-chars-long-here',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
}

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value
}
