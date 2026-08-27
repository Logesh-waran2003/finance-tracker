import { db } from '@/lib/db'
import { loans, customers, profiles } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { createLoan } from '@/lib/modules/loans/service'
import { ServiceError } from '@/lib/modules/errors'

export async function GET(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const url = new URL(request.url)
  const search = url.searchParams.get('search')
  const status = url.searchParams.get('status')
  const agentId = url.searchParams.get('agent_id')

  const conditions: any[] = [isNull(loans.deleted_at)]

  if (actor.branch_id) conditions.push(eq(loans.branch_id, actor.branch_id))
  if (status) conditions.push(eq(loans.status, status as any))
  if (agentId) conditions.push(eq(loans.assigned_agent_id, agentId))

  const rows = await db
    .select({
      id: loans.id,
      loan_number: loans.loan_number,
      customer_name: customers.full_name,
      assigned_agent_name: profiles.full_name,
      loan_amount: loans.loan_amount,
      disbursed_amount: loans.disbursed_amount,
      daily_installment: loans.daily_installment,
      principal_outstanding: loans.principal_outstanding,
      penalty_outstanding: loans.penalty_outstanding,
      total_outstanding: loans.total_outstanding,
      status: loans.status,
      disbursement_date: loans.disbursement_date,
    })
    .from(loans)
    .leftJoin(customers, eq(loans.customer_id, customers.id))
    .leftJoin(profiles, eq(loans.assigned_agent_id, profiles.id))
    .where(and(...(conditions as [any, ...any[]])))
    .orderBy(desc(loans.created_at))
    .limit(200)

  if (search) {
    const q = search.toLowerCase()
    return NextResponse.json(
      rows.filter(
        r =>
          r.customer_name?.toLowerCase().includes(q) ||
          r.loan_number?.toLowerCase().includes(q),
      ),
    )
  }

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  try {
    const body = await request.json()
    const {
      customer_id,
      assigned_agent_id,
      loan_amount,
      interest_percentage,
      tenure,
      penalty_amount,
      disbursement_date,
      notes,
    } = body

    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    if (!assigned_agent_id) return NextResponse.json({ error: 'assigned_agent_id required' }, { status: 400 })
    if (!loan_amount || !tenure || !disbursement_date)
      return NextResponse.json({ error: 'loan_amount, tenure, disbursement_date required' }, { status: 400 })
    if (parseInt(tenure) <= 0)
      return NextResponse.json({ error: 'tenure must be greater than 0' }, { status: 400 })

    const computedDailyInstallment = parseFloat(loan_amount) / parseInt(tenure)

    const loan = await createLoan(db, {
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
      customerId: customer_id,
      loanAmount: parseFloat(loan_amount),
      interestPercentage: parseFloat(interest_percentage ?? '0'),
      dailyInstallment: computedDailyInstallment,
      penaltyAmount: parseFloat(penalty_amount ?? '0'),
      disbursementDate: disbursement_date,
      assignedAgentId: assigned_agent_id,
      notes: notes ?? undefined,
    })

    return NextResponse.json(loan, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ServiceError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[POST /api/admin/loans]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
