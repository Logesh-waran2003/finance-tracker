import NextAuth from 'next-auth'
import type { Session } from 'next-auth'
import type { UserRole } from '@/types/database'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { profiles, auditLogs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

/** How long a JWT is trusted before we re-check the account against the DB. */
const REVALIDATE_MS = 60_000

/**
 * The claims we put on the token.
 *
 * next-auth v5 beta does not reliably pick up a `declare module 'next-auth/jwt'`
 * augmentation, so the token is typed explicitly here instead. This is a real
 * type, not `any` — the fields below are checked at every use.
 */
type AppClaims = {
  id?: string
  role?: UserRole
  branch_id?: string | null
  employee_code?: string | null
  password_version?: number
  /** Epoch ms of the last DB freshness check. */
  checked_at?: number
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db
          .select()
          .from(profiles)
          .where(eq(profiles.email, credentials.email as string))
          .limit(1)
          .then(r => r[0])

        if (!user) return null
        if (!user.is_active) return null

        const valid = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!valid) return null

        await db
          .update(profiles)
          .set({ last_login_at: new Date() })
          .where(eq(profiles.id, user.id))

        await db.insert(auditLogs).values({
          actor_id: user.id,
          actor_name: user.full_name,
          actor_email: user.email,
          action: 'LOGIN',
          entity_type: 'session',
          entity_id: user.id,
          after_data: { role: user.role, branch_id: user.branch_id ?? null },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
          branch_id: user.branch_id,
          employee_code: user.employee_code,
          // Embed current password_version in token so we can detect stale tokens
          password_version: user.password_version,
        }
      },
    }),
  ],
  callbacks: {
    /**
     * The freshness check lives here, not in session().
     *
     * It used to run a SELECT on profiles on EVERY session read, and proxy.ts
     * calls auth() on every request — so every page view and every API call
     * paid a database round trip before doing any work, which defeats the
     * point of a JWT session. Rate-limiting it to once a minute removes ~99%
     * of those queries.
     *
     * Trade-off: after a password change or a deactivation, an existing
     * session stays valid for at most REVALIDATE_MS. That is deliberate and
     * documented; `trigger === 'update'` forces an immediate re-check.
     */
    async jwt({ token, user, trigger }) {
      const t = token as typeof token & AppClaims
      if (user) {
        t.id = user.id
        t.role = user.role
        t.branch_id = user.branch_id
        t.employee_code = user.employee_code
        t.password_version = user.password_version ?? 0
        t.checked_at = Date.now()
        return t
      }

      if (!t.id) return t

      const due = Date.now() - (t.checked_at ?? 0) > REVALIDATE_MS
      if (!due && trigger !== 'update') return t

      const dbUser = await db
        .select({
          password_version: profiles.password_version,
          is_active: profiles.is_active,
        })
        .from(profiles)
        .where(eq(profiles.id, t.id))
        .limit(1)
        .then(r => r[0])

      // Clearing id is what session() reads as "this session is dead".
      if (!dbUser || !dbUser.is_active) {
        t.id = undefined
        return t
      }
      if (dbUser.password_version !== t.password_version) {
        t.id = undefined
        return t
      }

      t.checked_at = Date.now()
      return t
    },

    async session({ session, token }) {
      const t = token as typeof token & AppClaims
      // jwt() clears `id` when the account was deactivated or the password
      // changed. A session with no user is treated as expired by next-auth —
      // the same invalidation behaviour as before, with no query on this path.
      // A token carrying an id but no role is malformed, not a valid session.
      if (!t?.id || !t.role) {
        return { ...session, user: undefined } as unknown as Session
      }

      session.user.id = t.id
      session.user.role = t.role
      session.user.branch_id = t.branch_id ?? null
      session.user.employee_code = t.employee_code ?? null

      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 hours
})
