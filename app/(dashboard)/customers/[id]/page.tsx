import { auth } from '@/auth'
import { db } from '@/lib/db'
import { customers, dues, collections, profiles } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { EditDueDialog } from '@/components/customers/edit-due-dialog'

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) redirect('/login')

  const { id } = await params
  const role = (session.user as any).role

  const customer = await db.select().from(customers).where(eq(customers.id, id)).limit(1).then(r => r[0])
  if (!customer) redirect('/customers')

  // RBAC — agent can view any customer they've collected from
  if (role === 'COLLECTION_AGENT') {
    const hasCollection = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(
        eq(collections.customer_id, id),
        eq(collections.agent_id, session.user.id),
        isNull(collections.deleted_at),
      ))
      .limit(1)
      .then(r => r.length > 0)
    if (!hasCollection) redirect('/customers')
  }

  const agent = customer.assigned_agent_id
    ? await db.select({ full_name: profiles.full_name }).from(profiles).where(eq(profiles.id, customer.assigned_agent_id)).limit(1).then(r => r[0])
    : null

  const [duesList, collectionsList] = await Promise.all([
    db.select().from(dues).where(eq(dues.customer_id, id)).orderBy(dues.created_at),
    db.select().from(collections).where(eq(collections.customer_id, id)).orderBy(collections.collected_at),
  ])

  const confirmedFreeform = collectionsList
    .filter(c => c.status === 'CONFIRMED' && !c.due_id && !c.deleted_at)
    .reduce((sum, c) => sum + parseFloat(c.amount as string), 0)

  const totalOutstanding = Math.max(0,
    parseFloat(customer.opening_balance as string ?? '0')
    + duesList
        .filter(d => d.status !== 'PAID' && d.status !== 'CANCELLED')
        .reduce((sum, d) => sum + parseFloat(d.outstanding_amount as string), 0)
    - confirmedFreeform
  )

  const STATUS_BADGE: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700',
    PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }

  const COL_STATUS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }

  // Timeline: combine dues + collections sorted by date
  const timeline = [
    ...duesList.map(d => ({ type: 'due' as const, date: d.created_at, data: d })),
    ...collectionsList.map(c => ({ type: 'collection' as const, date: c.collected_at, data: c })),
  ].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{customer.full_name}</h1>
          <p className="text-gray-500 text-sm">{customer.customer_code}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${customer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white rounded-xl border p-4 text-sm">
        <div><span className="text-gray-500">Phone</span><p className="font-medium mt-0.5">{customer.phone ?? '—'}</p></div>
        <div><span className="text-gray-500">Email</span><p className="font-medium mt-0.5">{customer.email ?? '—'}</p></div>
        <div><span className="text-gray-500">Area / City</span><p className="font-medium mt-0.5">{[customer.area, customer.city].filter(Boolean).join(', ') || '—'}</p></div>
        <div><span className="text-gray-500">Address</span><p className="font-medium mt-0.5">{customer.address ?? '—'}</p></div>
        <div><span className="text-gray-500">Assigned Agent</span><p className="font-medium mt-0.5">{agent?.full_name ?? '—'}</p></div>
        <div><span className="text-gray-500">Outstanding Balance</span><p className="font-medium mt-0.5">₹{parseFloat(customer.opening_balance as string).toLocaleString()}</p></div>
        {customer.gps_lat && customer.gps_lng && (
          <div><span className="text-gray-500">GPS</span><p className="font-medium mt-0.5 text-xs">{customer.gps_lat}, {customer.gps_lng}</p></div>
        )}
        {customer.notes && <div className="sm:col-span-2"><span className="text-gray-500">Notes</span><p className="font-medium mt-0.5">{customer.notes}</p></div>}
      </div>

      {/* Outstanding summary */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
        <p className="text-sm text-orange-800 font-medium">Total Outstanding</p>
        <p className="text-xl font-bold text-orange-700">₹{totalOutstanding.toLocaleString()}</p>
      </div>

      {/* Dues table */}
      <div>
        <h2 className="text-base font-semibold mb-2">Dues</h2>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {duesList.length === 0 && <p className="text-sm text-gray-400">No dues</p>}
          {duesList.map(d => (
            <div key={d.id} className="bg-white rounded-xl border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{d.invoice_number ?? '—'}</p>
                  <p className="text-xs text-gray-400">{d.due_date ?? 'No due date'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-gray-500">Amount</p><p className="font-medium">₹{parseFloat(d.amount as string).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Outstanding</p><p className="font-medium text-orange-600">₹{parseFloat(d.outstanding_amount as string).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Penalty</p><p className="font-medium">{d.penalty_rate && parseFloat(d.penalty_rate as string) > 0 ? `${parseFloat(d.penalty_rate as string)}%` : '—'}</p></div>
              </div>
              {role === 'ADMIN' && <EditDueDialog due={{ id: d.id, invoice_number: d.invoice_number, due_date: d.due_date, penalty_rate: d.penalty_rate as string | null, notes: d.notes }} />}
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Invoice', 'Amount', 'Outstanding', 'Due Date', 'Penalty', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {duesList.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No dues</td></tr>}
              {duesList.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{d.invoice_number ?? '—'}</td>
                  <td className="px-4 py-2 font-medium">₹{parseFloat(d.amount as string).toLocaleString()}</td>
                  <td className="px-4 py-2 text-orange-600 font-medium">₹{parseFloat(d.outstanding_amount as string).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-500">{d.due_date ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{d.penalty_rate && parseFloat(d.penalty_rate as string) > 0 ? `${parseFloat(d.penalty_rate as string)}%` : '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {role === 'ADMIN' && <EditDueDialog due={{ id: d.id, invoice_number: d.invoice_number, due_date: d.due_date, penalty_rate: d.penalty_rate as string | null, notes: d.notes }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-base font-semibold mb-2">Activity Timeline</h2>
        <div className="space-y-2">
          {timeline.length === 0 && <p className="text-sm text-gray-400">No activity yet</p>}
          {timeline.map((item, i) => (
            <div key={i} className="flex gap-3 bg-white rounded-lg border p-3 text-sm">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.type === 'collection' ? 'bg-green-500' : 'bg-blue-400'}`} />
              <div className="flex-1 min-w-0">
                {item.type === 'due' && (
                  <>
                    <p className="font-medium">Due created — ₹{parseFloat((item.data as any).amount).toLocaleString()}</p>
                    {(item.data as any).invoice_number && <p className="text-gray-500 text-xs">Invoice: {(item.data as any).invoice_number}</p>}
                  </>
                )}
                {item.type === 'collection' && (
                  <>
                    <p className="font-medium">Collection — ₹{parseFloat((item.data as any).amount).toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">{(item.data as any).payment_mode} &middot; {(item.data as any).collection_number}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${COL_STATUS[(item.data as any).status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {(item.data as any).status}
                      </span>
                    </p>
                  </>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{new Date(item.date!).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
