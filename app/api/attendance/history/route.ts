import { auth } from '@/auth'
import { db } from '@/lib/db'
import { attendance } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const requestedId = url.searchParams.get('employee_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  // Only admins may query other employees
  const role = (session.user as any).role
  const employeeId =
    requestedId && role === 'ADMIN' ? requestedId : session.user.id

  const conditions = [eq(attendance.employee_id, employeeId)]
  if (start) conditions.push(gte(attendance.date, start))
  if (end) conditions.push(lte(attendance.date, end))

  const rows = await db
    .select()
    .from(attendance)
    .where(and(...conditions))
    .orderBy(desc(attendance.date))
    .limit(30)

  return NextResponse.json(rows)
}
