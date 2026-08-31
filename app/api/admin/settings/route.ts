import { db } from '@/lib/db'
import { settings, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, updateSettingsSchema } from '@/lib/validation'

export async function GET() {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const data = await db.select().from(settings).limit(1).then(r => r[0] ?? null)
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, updateSettingsSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const updates: Record<string, unknown> = { updated_at: new Date() }
  const fields = ['company_name', 'currency', 'currency_symbol', 'timezone', 'financial_year_start'] as const
  for (const key of fields) {
    if (data[key] !== undefined) updates[key] = data[key]
  }

  const existing = await db.select().from(settings).limit(1).then(r => r[0])
  let result
  if (existing) {
    const [updated] = await db.update(settings).set(updates).where(eq(settings.id, existing.id)).returning()
    result = updated
  } else {
    const [inserted] = await db.insert(settings).values(updates as any).returning()
    result = inserted
  }

  db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'UPDATE',
    entity_type: 'settings',
    after_data: Object.fromEntries(Object.entries(updates).filter(([k]) => k !== 'updated_at')),
    branch_id: actor.branch_id,
  }).catch(() => {})

  return NextResponse.json(result)
}
