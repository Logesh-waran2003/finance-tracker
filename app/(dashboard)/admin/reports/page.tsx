import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { AdminReportsClient } from '@/components/reports/admin-reports-client'
import type { Session } from 'next-auth'

export default async function AdminReportsPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const agents = await db.select({ id: profiles.id, full_name: profiles.full_name })
    .from(profiles)
    .where(eq(profiles.is_active, true))

  return <AdminReportsClient agents={agents} />
}
