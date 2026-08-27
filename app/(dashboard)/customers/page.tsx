import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { customers, dues, loans, collections } from '@/lib/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'
import Link from 'next/link'
import type { Session } from 'next-auth'

export default async function AgentCustomersPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'COLLECTION_AGENT' && role !== 'ADMIN') redirect('/dashboard')

  const agentId = session.user.id

  const [custList, duesAgg, loanAgg, freeformAgg] = await Promise.all([
    db.select({
      id: customers.id,
      customer_code: customers.customer_code,
      full_name: customers.full_name,
      phone: customers.phone,
      area: customers.area,
      city: customers.city,
      opening_balance: customers.opening_balance,
      is_active: customers.is_active,
      assigned_agent_id: customers.assigned_agent_id,
    }).from(customers)
      .where(and(eq(customers.assigned_agent_id, agentId), eq(customers.is_active, true))),

    db.select({
      customer_id: dues.customer_id,
      total: sql<string>`coalesce(sum(${dues.outstanding_amount}), '0')`,
    }).from(dues)
      .where(and(
        sql`${dues.status} NOT IN ('PAID', 'CANCELLED')`,
        isNull(dues.deleted_at)
      ))
      .groupBy(dues.customer_id),

    db.select({
      customer_id: loans.customer_id,
      total: sql<string>`coalesce(sum(${loans.total_outstanding}), '0')`,
    }).from(loans)
      .where(sql`${loans.status} NOT IN ('COMPLETED', 'CANCELLED', 'DRAFT')`)
      .groupBy(loans.customer_id),

    db.select({
      customer_id: collections.customer_id,
      total: sql<string>`coalesce(sum(${collections.amount}), '0')`,
    }).from(collections)
      .where(and(
        eq(collections.status, 'CONFIRMED'),
        isNull(collections.due_id),
        isNull(collections.deleted_at)
      ))
      .groupBy(collections.customer_id),
  ])

  const duesMap = new Map(duesAgg.map(o => [o.customer_id, o.total ?? '0']))
  const loanMap = new Map(loanAgg.map(o => [o.customer_id, o.total ?? '0']))
  const freeformMap = new Map(freeformAgg.map(o => [o.customer_id, o.total ?? '0']))

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">My Customers</h1>
      <p className="text-sm text-gray-500">{custList.length} assigned customer{custList.length !== 1 ? 's' : ''}</p>

      {custList.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">No customers assigned yet</div>
      )}

      <div className="bg-white rounded-xl border overflow-x-auto">
        {custList.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Code', 'Name', 'Phone', 'Area', 'Outstanding', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {custList.map(c => {
                const outstanding_total = Math.max(0,
                  parseFloat(duesMap.get(c.id) ?? '0')
                  + parseFloat(c.opening_balance as string ?? '0')
                  + parseFloat(loanMap.get(c.id) ?? '0')
                  - parseFloat(freeformMap.get(c.id) ?? '0')
                )
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.customer_code}</td>
                    <td className="px-4 py-3 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.area ?? c.city ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-orange-600">
                      ₹{outstanding_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
