import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { AppShell } from '@/components/app-shell'
import { IdleLogout } from '@/components/idle-logout'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const profile = await db
    .select({ full_name: profiles.full_name, role: profiles.role, is_active: profiles.is_active })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1)
    .then(r => r[0])

  if (!profile?.is_active) redirect('/login?error=account_inactive')

  return (
    <AppShell userRole={profile.role} userName={profile.full_name}>
      <IdleLogout />
      {children}
    </AppShell>
  )
}
