/**
 * NextAuth v5 module augmentation.
 *
 * Without this, `session.user.role` does not exist on the type, so every server
 * page in the app was written as `(session.user as any).role`. That produced ~30
 * `no-explicit-any` warnings and, worse, removed all type safety from the single
 * most security-relevant value in the app: the caller's role.
 *
 * Declaring it once here means role, branch_id and employee_code are typed
 * everywhere, and `as any` can be deleted from every call site.
 */
import type { UserRole } from './database'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      branch_id: string | null
      employee_code: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: UserRole
    branch_id: string | null
    employee_code: string | null
    password_version: number
  }
}

declare module 'next-auth/jwt' {
  /**
   * These are optional because a JWT exists from the moment NextAuth mints it,
   * but the claims are only populated on the sign-in pass through the `jwt()`
   * callback. Typing them as required would be a lie the compiler enforces in
   * the wrong direction.
   */
  interface JWT {
    id?: string
    role?: UserRole
    branch_id?: string | null
    employee_code?: string | null
    password_version?: number
    /** Epoch ms of the last DB freshness check. See auth.ts REVALIDATE_MS. */
    checked_at?: number
  }
}

export {}
