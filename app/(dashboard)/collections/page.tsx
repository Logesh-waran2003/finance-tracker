import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { collections, customers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { CollectionForm } from '@/components/collections/collection-form'
import type { Session } from 'next-auth'

export default async function CollectionsPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') redirect('/dashboard')

  const userId = session.user.id

  const [assignedCustomers, initialCollections] = await Promise.all([
    db.select({
      id: customers.id,
      customer_code: customers.customer_code,
      full_name: customers.full_name,
    }).from(customers)
      .where(and(eq(customers.assigned_agent_id, userId), eq(customers.is_active, true))),

    db.select({
      id: collections.id,
      collection_number: collections.collection_number,
      customer_id: collections.customer_id,
      customer_name: customers.full_name,
      amount: collections.amount,
      payment_mode: collections.payment_mode,
      status: collections.status,
      collected_at: collections.collected_at,
      notes: collections.notes,
      rejected_reason: collections.rejected_reason,
    }).from(collections)
      .leftJoin(customers, eq(collections.customer_id, customers.id))
      .where(eq(collections.agent_id, userId))
      .orderBy(desc(collections.collected_at))
      .limit(50),
  ])

  return (
    <CollectionForm
      customers={assignedCustomers.map(c => ({ ...c, outstanding_total: '0' }))}
      initial={initialCollections.map(r => ({
        ...r,
        collection_number: r.collection_number ?? null,
        collected_at: r.collected_at?.toISOString() ?? null,
      }))}
    />
  )
}
