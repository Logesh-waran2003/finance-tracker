import { db } from '@/lib/db'
import { loanRequests, customers, profiles, notifications, auditLogs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { createLoan } from '@/lib/modules/loans/service'
import { ServiceError } from '@/lib/modules/errors'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, agent_id, rejection_reason } = body

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
  }

  // Fetch the request
  const [loanReq] = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.id, id))
    .limit(1)

  if (!loanReq) {
    return NextResponse.json({ error: 'Loan request not found' }, { status: 404 })
  }

  if (loanReq.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Loan request is already ${loanReq.status.toLowerCase()}` },
      { status: 400 },
    )
  }

  // IDOR: branch-scoped admins can only act on requests from their branch
  if (actor.branch_id && loanReq.branch_id !== actor.branch_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (action === 'reject') {
      const [updated] = await db
        .update(loanRequests)
        .set({
          status: 'REJECTED',
          reviewed_by: actor.id,
          rejection_reason: rejection_reason ?? null,
          updated_at: new Date(),
        })
        .where(eq(loanRequests.id, id))
        .returning()

      db.insert(auditLogs).values({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_email: actor.email,
        action: 'REJECT',
        entity_type: 'loan_request',
        entity_id: id,
        after_data: { request_number: loanReq.request_number, reason: rejection_reason ?? null },
        branch_id: actor.branch_id,
      }).catch(() => {})

      return NextResponse.json(updated)
    }

    // action === 'approve' — auto-assign to the requesting agent
    const agent_id = loanReq.requested_by

    // If new customer, create them first
    let customerId = loanReq.customer_id

    if (!customerId) {
      if (!loanReq.new_customer_name) {
        return NextResponse.json(
          { error: 'Loan request has no customer_id and no new_customer_name' },
          { status: 400 },
        )
      }

      const customer_code = `CUST-${Date.now().toString().slice(-6)}`
      const [newCustomer] = await db
        .insert(customers)
        .values({
          customer_code,
          full_name: loanReq.new_customer_name,
          phone: loanReq.new_customer_phone ?? null,
          area: loanReq.new_customer_area ?? null,
          branch_id: actor.branch_id ?? null,
          opening_balance: '0',
          is_active: true,
          created_by: actor.id,
          assigned_agent_id: agent_id,
        })
        .returning()

      customerId = newCustomer.id
    }

    // Disbursement date = original requested date (stored as-is)
    // Repayment starts today regardless of when admin approved
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

    // Create the loan
    const loan = await createLoan(db, {
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      branchId: actor.branch_id,
      customerId,
      loanAmount: parseFloat(loanReq.loan_amount),
      interestPercentage: parseFloat(loanReq.interest_percentage),
      dailyInstallment: parseFloat(loanReq.daily_installment),
      penaltyAmount: parseFloat(loanReq.penalty_amount),
      disbursementDate: loanReq.disbursement_date,
      repaymentStartDate: todayIST,
      assignedAgentId: agent_id,
      notes: loanReq.notes ?? undefined,
    })

    // Update loan request to APPROVED
    const [updated] = await db
      .update(loanRequests)
      .set({
        status: 'APPROVED',
        reviewed_by: actor.id,
        created_loan_id: loan.id,
        updated_at: new Date(),
      })
      .where(eq(loanRequests.id, id))
      .returning()

    // Fire-and-forget: notify the requesting agent with loan number
    db.insert(notifications)
      .values({
        recipient_id: loanReq.requested_by,
        type: 'GENERAL' as const,
        title: 'Loan Request Approved',
        body: `Your loan request ${loanReq.request_number} has been approved — Loan ${loan.loan_number} is now active`,
        reference_id: updated.id,
        reference_type: 'loan_request',
      })
      .catch(() => {})

    // Fire-and-forget: notify all admins in the branch with loan number
    db.select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          eq(profiles.role, 'ADMIN'),
          eq(profiles.is_active, true),
          ...(actor.branch_id ? [eq(profiles.branch_id, actor.branch_id)] : []),
        )
      )
      .then(admins =>
        admins.length > 0
          ? db.insert(notifications).values(
              admins.map(a => ({
                recipient_id: a.id,
                type: 'GENERAL' as const,
                title: 'Loan Created',
                body: `Loan ${loan.loan_number} created for request ${loanReq.request_number}`,
                reference_id: loan.id,
                reference_type: 'loan',
              }))
            )
          : null
      )
      .catch(() => {})

    db.insert(auditLogs).values({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_email: actor.email,
        action: 'APPROVE',
        entity_type: 'loan_request',
        entity_id: id,
        after_data: { request_number: loanReq.request_number, loan_number: loan.loan_number },
        branch_id: actor.branch_id,
      }).catch(() => {})

    return NextResponse.json({ ...updated, loan })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
