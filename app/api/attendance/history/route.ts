import { db } from '@/lib/db'
import { attendance } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { requireRole, isResponse, withErrorHandler } from '@/lib/auth/authorize'

export const GET = withErrorHandler(async (request: Request) => {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN', 'STAFF'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const requestedId = url.searchParams.get('employee_id')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  // Agents always see only their own records; only ADMIN may query other employees
  const employeeId =
    requestedId && actor.role === 'ADMIN' ? requestedId : actor.id

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
})
