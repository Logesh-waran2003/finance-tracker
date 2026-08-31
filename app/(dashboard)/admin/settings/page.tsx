import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { settings, branches } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bi } from '@/components/ui/bi'
import { PageHeader } from '@/components/ui/page-header'
import { CompanySettingsForm } from '@/components/admin/company-settings-form'
import { BranchesPanel } from '@/components/admin/branches-panel'

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/dashboard')

  const [settingsRows, branchRows] = await Promise.all([
    db.select().from(settings).limit(1),
    db.select().from(branches).orderBy(asc(branches.name)),
  ])

  const currentSettings = settingsRows[0] ?? null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titleKey="settings" subtitle={<Bi k="manageCompanyAndBranches" />} />

      <Tabs defaultValue="company">
        <TabsList className="w-full group-data-horizontal/tabs:h-14 md:group-data-horizontal/tabs:h-11">
          <TabsTrigger value="company">
            <Bi k="company" />
          </TabsTrigger>
          <TabsTrigger value="branches">
            <Bi k="branches" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanySettingsForm initialData={currentSettings} />
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <BranchesPanel initialBranches={branchRows} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
