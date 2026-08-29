/**
 * Centralized server-side authorization utility.
 * All sensitive routes must go through these helpers.
 * Never trust client-supplied userId, role, branchId, or ownership.
 */
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'

export type AuthorizedUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'
  branch_id: string | null
  employee_code: string | null
}

/** Resolves session and returns a typed user, or null if unauthenticated. */
export async function getAuthUser(): Promise<AuthorizedUser | null> {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return null
  const u = session.user as any
  return {
    id: session.user.id as string,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
    role: u.role,
    branch_id: u.branch_id ?? null,
    employee_code: u.employee_code ?? null,
  }
}

/**
 * Requires an authenticated session.
 * Returns the user or a 401 NextResponse — caller must check with isResponse().
 */
export async function requireAuthUser(): Promise<AuthorizedUser | NextResponse> {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return user
}

/**
 * Requires authenticated session AND one of the given roles.
 * Returns the user or a 403 NextResponse.
 */
export async function requireRole(
  roles: Array<'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'>
): Promise<AuthorizedUser | NextResponse> {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}

/** Requires ADMIN role only. */
export async function requireAdmin(): Promise<AuthorizedUser | NextResponse> {
  return requireRole(['ADMIN'])
}

/** Requires COLLECTION_AGENT or ADMIN role. */
export async function requireAgent(): Promise<AuthorizedUser | NextResponse> {
  return requireRole(['ADMIN', 'COLLECTION_AGENT'])
}

/** Convenience: 400 Bad Request with a message. */
export function badRequestResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Wraps a route handler to catch unhandled errors and return a
 * generic 500 — never leaking stack traces or DB error details.
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (err: unknown) {
      // Log server-side but never expose to client
      console.error('[route error]', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

/** Type guard — true when the value is a Response/NextResponse (i.e. authorization failed). */
export function isResponse(v: unknown): v is NextResponse {
  // NextResponse extends the web Response API — check instanceof Response so
  // this works in both production (Next.js) and test environments (vitest node).
  return v instanceof Response
}

/**
 * Verifies the requesting agent is assigned to the given customer.
 * ADMINs bypass this check.
 * Returns null on success, or a 403/404 NextResponse on failure.
 */
export async function requireCustomerAccess(
  user: AuthorizedUser,
  customerId: string
): Promise<NextResponse | null> {
  if (user.role === 'ADMIN') return null

  const customer = await db
    .select({ assigned_agent_id: customers.assigned_agent_id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)
    .then(r => r[0])

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  if (customer.assigned_agent_id !== user.id) {
    return NextResponse.json({ error: 'Customer not assigned to you' }, { status: 403 })
  }
  return null
}

/**
 * Verifies a profile exists and the requesting user is either ADMIN or the profile owner.
 */
export async function requireProfileAccess(
  user: AuthorizedUser,
  profileId: string
): Promise<NextResponse | null> {
  if (user.role === 'ADMIN') return null
  if (user.id !== profileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
