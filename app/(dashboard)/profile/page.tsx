import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { profiles, branches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileInfoCard } from '@/components/profile-info-card'
import { ProfileEditForm } from '@/components/profile-edit-form'
import { ChangePasswordForm } from '@/components/change-password-form'
import { format } from 'date-fns'

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

  const ROLE_LABEL: Record<string, string> = {
    ADMIN: 'Admin',
    COLLECTION_AGENT: 'Collection Agent',
    STAFF: 'Staff',
  }

  const infoItems = [
    { label: 'Email', value: profile.email },
    { label: 'Role', value: ROLE_LABEL[profile.role] ?? profile.role },
    { label: 'Employee Code', value: profile.employee_code ?? '—' },
    { label: 'Department', value: profile.department ?? '—' },
    { label: 'Branch', value: profile.branch_name ?? 'Unassigned' },
    {
      label: 'Joining Date',
      value: profile.joining_date ? format(new Date(profile.joining_date), 'dd MMM yyyy') : '—',
    },
    {
      label: 'Last Login',
      value: profile.last_login_at ? format(new Date(profile.last_login_at), 'dd MMM yyyy, hh:mm a') : '—',
    },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account details.</p>
      </div>

      <ProfileInfoCard name={profile.full_name} items={infoItems} />

      <ProfileEditForm
        initialName={profile.full_name}
        initialPhone={profile.phone ?? ''}
      />

      <ChangePasswordForm />
    </div>
  )
}
