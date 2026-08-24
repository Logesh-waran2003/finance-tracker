import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { collections, customers, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { AdminCollectionsClient } from '@/components/collections/admin-collections-client'

function toIST(d: Date | null) {
  return d?.toISOString() ?? null
}

export default async function AdminCollectionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const rawCollections = await db
    .select({
      id: collections.id,
      collection_number: collections.collection_number,
      customer_id: collections.customer_id,
      customer_name: customers.full_name,
      agent_id: collections.agent_id,
      agent_name: profiles.full_name,
      due_id: collections.due_id,
      amount: collections.amount,
      payment_mode: collections.payment_mode,
      payment_reference: collections.payment_reference,
      notes: collections.notes,
      status: collections.status,
      rejected_reason: collections.rejected_reason,
      confirmed_at: collections.confirmed_at,
      collected_at: collections.collected_at,
      created_at: collections.created_at,
    })
    .from(collections)
    .leftJoin(customers, eq(collections.customer_id, customers.id))
    .leftJoin(profiles, eq(collections.agent_id, profiles.id))
    .orderBy(desc(collections.collected_at))
    .limit(100)

  const agents = await db
    .select({ id: profiles.id, full_name: profiles.full_name })
    .from(profiles)
    .where(eq(profiles.role, 'COLLECTION_AGENT'))
    .orderBy(profiles.full_name)

  const serialized = rawCollections.map(c => ({
    ...c,
    confirmed_at: toIST(c.confirmed_at as Date | null),
    collected_at: toIST(c.collected_at as Date | null),
    created_at: toIST(c.created_at as Date | null),
  }))

  return (
    <AdminCollectionsClient
      initial={serialized as any}
      agents={agents}
    />
  )
}
