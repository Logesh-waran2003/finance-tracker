import { db } from '@/lib/db'
import { profiles, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, ilike, or, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, createEmployeeSchema } from '@/lib/validation'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const search = url.searchParams.get('search') ?? ''
  const role = url.searchParams.get('role') ?? ''
  const isActive = url.searchParams.get('is_active') ?? ''

  const conditions: ReturnType<typeof eq>[] = []

  // Branch isolation — admin only sees employees in their branch
  if (actor.branch_id) {
    conditions.push(eq(profiles.branch_id, actor.branch_id) as any)
  }

  if (search) {
    conditions.push(
      or(
        ilike(profiles.full_name, `%${search}%`),
        ilike(profiles.email, `%${search}%`),
        ilike(profiles.employee_code, `%${search}%`)
      ) as any
    )
  }
  if (role) conditions.push(eq(profiles.role, role as any) as any)
  if (isActive === 'true') conditions.push(eq(profiles.is_active, true) as any)
  if (isActive === 'false') conditions.push(eq(profiles.is_active, false) as any)

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
      branch_id: profiles.branch_id,
      joining_date: profiles.joining_date,
      is_active: profiles.is_active,
      last_login_at: profiles.last_login_at,
      created_at: profiles.created_at,
    })
    .from(profiles)
    .where(conditions.length ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined)
    .orderBy(profiles.full_name)

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const parsed = await parseBody(request, createEmployeeSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  const password_hash = await bcrypt.hash(data.password, 12)

  let emp: typeof profiles.$inferSelect
  try {
    ;[emp] = await db.insert(profiles).values({
      full_name: data.full_name,
      email: data.email,
      password_hash,
      role: data.role ?? 'STAFF',
      employee_code: data.employee_code ?? null,
      // Always assign to admin's branch; super-admin (no branch) may specify one
      branch_id: actor.branch_id ?? (data.branch_id ?? null),
      department: data.department ?? null,
      designation: data.designation ?? null,
      joining_date: data.joining_date ?? null,
      phone: data.phone ?? null,
      is_active: true,
    }).returning()
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Email or employee code already exists' }, { status: 409 })
    }
    throw e
  }

  await db.insert(auditLogs).values({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_email: actor.email,
    action: 'CREATE',
    entity_type: 'employee',
    entity_id: emp.id,
    after_data: { email: emp.email, role: emp.role },
    branch_id: actor.branch_id,
  })

  const { password_hash: _, ...safe } = emp
  return NextResponse.json(safe, { status: 201 })
}
