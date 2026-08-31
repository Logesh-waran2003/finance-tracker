import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { profiles, branches } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import { EmployeeTable } from '@/components/employees/employee-table'

export default async function AdminEmployeesPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/dashboard')

  const [employees, branchList] = await Promise.all([
    db.select({
      id: profiles.id,
      full_name: profiles.full_name,
      email: profiles.email,
      phone: profiles.phone,
      role: profiles.role,
      employee_code: profiles.employee_code,
      department: profiles.department,
      designation: profiles.designation,
      branch_id: profiles.branch_id,
      joining_date: profiles.joining_date,
      is_active: profiles.is_active,
    }).from(profiles).orderBy(asc(profiles.full_name)),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(
      (await import('drizzle-orm')).eq(branches.is_active, true)
    ).orderBy(asc(branches.name)),
  ])

  return <EmployeeTable initial={employees} branches={branchList} />
}
