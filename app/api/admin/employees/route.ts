import { auth } from '@/auth'
import { db } from '@/lib/db'
import { profiles, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, ilike, or, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { Session } from 'next-auth'

function getAdmin(session: Session | null) {
  if (!session?.user?.id) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session.user
}

export async function GET(request: Request) {
  const session = (await auth()) as Session | null
  if (!getAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const search = url.searchParams.get('search') ?? ''
  const role = url.searchParams.get('role') ?? ''
  const isActive = url.searchParams.get('is_active') ?? ''

  const rows = await db.select({
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
  }).from(profiles)

  let filtered = rows
  if (search) filtered = filtered.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    (r.employee_code ?? '').toLowerCase().includes(search.toLowerCase())
  )
  if (role) filtered = filtered.filter(r => r.role === role)
  if (isActive === 'true') filtered = filtered.filter(r => r.is_active === true)
  if (isActive === 'false') filtered = filtered.filter(r => r.is_active === false)

  return NextResponse.json(filtered)
}

export async function POST(request: Request) {
  const session = (await auth()) as Session | null
  const actor = getAdmin(session)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { full_name, email, password, role, employee_code, branch_id, department, designation, joining_date, phone } = body

  if (!full_name || !email || !password) {
    return NextResponse.json({ error: 'full_name, email, and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const [emp] = await db.insert(profiles).values({
    full_name,
    email,
    password_hash,
    role: role ?? 'STAFF',
    employee_code: employee_code || null,
    branch_id: branch_id || null,
    department: department || null,
    designation: designation || null,
    joining_date: joining_date || null,
    phone: phone || null,
    is_active: true,
  }).returning()

  await db.insert(auditLogs).values({
    actor_id: actor.id as string,
    actor_name: actor.name ?? '',
    action: 'CREATE',
    entity_type: 'employee',
    entity_id: emp.id,
    after_data: JSON.stringify({ email: emp.email, role: emp.role }),
  })

  const { password_hash: _, ...safe } = emp
  return NextResponse.json(safe, { status: 201 })
}
