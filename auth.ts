import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

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

        // Update last_login_at
        await db
          .update(profiles)
          .set({ last_login_at: new Date() })
          .where(eq(profiles.id, user.id))

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
          branch_id: user.branch_id,
          employee_code: user.employee_code,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.branch_id = (user as any).branch_id
        token.employee_code = (user as any).employee_code
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).branch_id = token.branch_id
        ;(session.user as any).employee_code = token.employee_code
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
})
