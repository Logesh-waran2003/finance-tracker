import { auth } from '@/auth'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getSession() {
  return await auth()
}

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1)
    .then(r => r[0] ?? null)

  return user
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireRole(roles: string[]) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  const role = (session.user as any).role
  if (!roles.includes(role)) throw new Error('Forbidden')
  return session
}
