import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { requireRole, isResponse } from '@/lib/auth/authorize'

export async function GET() {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN'])
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipient_id, actor.id), eq(notifications.is_read, false)))
    .orderBy(desc(notifications.created_at))
    .limit(20)

  const items = rows.map(row => ({
    id: row.id,
    type: 'info' as const,
    title: row.title,
    message: row.body,
    href: row.reference_type === 'loan_request' ? '/loans#loan-requests' : '/loans',
    dbNotification: true as const,
  }))

  return NextResponse.json({ notifications: items, count: items.length })
}

export async function PATCH(request: Request) {
  const userOrRes = await requireRole(['COLLECTION_AGENT', 'ADMIN'])
  if (isResponse(userOrRes)) return userOrRes

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db
    .update(notifications)
    .set({ is_read: true })
    .where(eq(notifications.id, id))

  return NextResponse.json({ ok: true })
}
