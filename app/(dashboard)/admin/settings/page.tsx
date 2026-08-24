import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { settings, branches } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanySettingsForm } from '@/components/admin/company-settings-form'
import { BranchesPanel } from '@/components/admin/branches-panel'

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const [settingsRows, branchRows] = await Promise.all([
    db.select().from(settings).limit(1),
    db.select().from(branches).orderBy(asc(branches.name)),
  ])

  const currentSettings = settingsRows[0] ?? null
  const allBranches = branchRows

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage company configuration and branches.</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanySettingsForm initialData={currentSettings} />
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <BranchesPanel initialBranches={allBranches} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
