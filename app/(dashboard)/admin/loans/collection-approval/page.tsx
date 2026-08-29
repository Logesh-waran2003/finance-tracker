import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { loanPayments, loans, customers, profiles } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { Session } from 'next-auth'
import AdminCollectionApprovalClient from '@/components/loans/admin-collection-approval-client'

export default async function CollectionApprovalPage() {
  const session = (await auth()) as Session | null
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const branchId = (session.user as any).branch_id as string | null

  const rows = await db.execute(sql`
    SELECT
      p.id,
      p.payment_number,
      p.amount,
      p.payment_mode,
      p.scheduled_date,
      p.collected_at,
      l.loan_number,
      c.full_name  AS customer_name,
      ag.full_name AS agent_name
    FROM loan_payments p
    JOIN loans l     ON l.id = p.loan_id
    JOIN customers c ON c.id = p.customer_id
    JOIN profiles ag ON ag.id = p.agent_id
    WHERE p.status = 'PENDING'
      AND p.is_reversed = false
      ${branchId ? sql`AND l.branch_id = ${branchId}` : sql``}
    ORDER BY p.collected_at ASC
    LIMIT 200
  `) as any[]

  return <AdminCollectionApprovalClient initial={rows} />
}
