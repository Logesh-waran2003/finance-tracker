import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { profiles, branches } from '@/lib/db/schema'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Bi } from '@/components/ui/bi'
import { ProfileInfoCard, type ProfileInfoItem } from '@/components/profile-info-card'
import { ProfileEditForm, AppearanceCard } from '@/components/profile-edit-form'
import { ChangePasswordForm } from '@/components/change-password-form'
import { formatDate, formatDateTime } from '@/lib/format'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const rows = await db
    .select({
      id: profiles.id,
      full_name: profiles.full_name,
      email: profiles.email,
      phone: profiles.phone,
      role: profiles.role,
      employee_code: profiles.employee_code,
      department: profiles.department,
      designation: profiles.designation,
      joining_date: profiles.joining_date,
      last_login_at: profiles.last_login_at,
      branch_name: branches.name,
    })
    .from(profiles)
    .leftJoin(branches, eq(profiles.branch_id, branches.id))
    .where(eq(profiles.id, session.user.id))
    .limit(1)

  const profile = rows[0]
  if (!profile) redirect('/login')

  const dash = <span className="text-muted-foreground">—</span>

  const infoItems: ProfileInfoItem[] = [
    { k: 'email', value: <span className="break-all">{profile.email}</span> },
    { k: 'phone', value: profile.phone ?? dash },
    // <StatusBadge> is the single source of truth for role → colour + word.
    { k: 'role', value: <StatusBadge status={profile.role} /> },
    { k: 'employeeCode', value: profile.employee_code ?? dash },
    { k: 'department', value: profile.department ?? dash },
    { k: 'designation', value: profile.designation ?? dash },
    { k: 'branch', value: profile.branch_name ?? <Bi k="unassigned" /> },
    {
      k: 'joiningDate',
      value: profile.joining_date ? formatDate(profile.joining_date, 'medium') : dash,
    },
    {
      k: 'lastLogin',
      value: profile.last_login_at ? formatDateTime(profile.last_login_at) : dash,
    },
  ]

  return (
    <div className="space-y-5 md:max-w-2xl">
      <PageHeader titleKey="profile" />

      <ProfileInfoCard name={profile.full_name} items={infoItems} />

      <ProfileEditForm
        initialName={profile.full_name}
        initialPhone={profile.phone ?? ''}
      />

      <AppearanceCard />

      <ChangePasswordForm />
    </div>
  )
}
