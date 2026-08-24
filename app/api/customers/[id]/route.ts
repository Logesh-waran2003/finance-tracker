import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues, collections, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import type { Session } from 'next-auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const { id } = await params

  const [customer] = await db
    .select({
      id: customers.id,
      customer_code: customers.customer_code,
      full_name: customers.full_name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      area: customers.area,
      city: customers.city,
      state: customers.state,
      pincode: customers.pincode,
      gps_lat: customers.gps_lat,
      gps_lng: customers.gps_lng,
      assigned_agent_id: customers.assigned_agent_id,
      branch_id: customers.branch_id,
      opening_balance: customers.opening_balance,
      is_active: customers.is_active,
      notes: customers.notes,
      created_at: customers.created_at,
      agent_name: profiles.full_name,
    })
    .from(customers)
    .leftJoin(profiles, eq(customers.assigned_agent_id, profiles.id))
    .where(eq(customers.id, id))

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // RBAC: agents can only view their own assigned customers
  if (role === 'COLLECTION_AGENT' && customer.assigned_agent_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [dueList, collectionList] = await Promise.all([
    db.select().from(dues).where(eq(dues.customer_id, id)).orderBy(asc(dues.due_date)),
    db.select().from(collections).where(eq(collections.customer_id, id)).orderBy(asc(collections.collected_at)),
  ])

  return NextResponse.json({ ...customer, dues: dueList, collections: collectionList })
}
