import { db } from '@/lib/db'
import { loans, profiles } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { parseBody, patchLoanSchema } from '@/lib/validation'
import { getLoanWithDetails } from '@/lib/modules/loans/service'
import { logAudit } from '@/lib/modules/audit/service'
import { ServiceError } from '@/lib/modules/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes

  const { id } = await params

  const loan = await getLoanWithDetails(db, id)
  if (!loan) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }

  // Schedules summary counts
  const [summary] = await db.execute(sql`
    SELECT
      COUNT(*)                                    AS total,
      COUNT(*) FILTER (WHERE status = 'PAID')    AS paid,
      COUNT(*) FILTER (WHERE status = 'MISSED')  AS missed,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending
    FROM loan_schedules
    WHERE loan_id = ${id}
  `) as unknown as any[]

  // Recent 10 non-reversed payments
  const recentPayments = await db.execute(sql`
    SELECT
      lp.*,
      p.full_name AS agent_name
    FROM loan_payments lp
    JOIN profiles p ON p.id = lp.agent_id
    WHERE lp.loan_id = ${id}
      AND lp.is_reversed = false
    ORDER BY lp.created_at DESC
    LIMIT 10
  `) as unknown as any[]

  return NextResponse.json({
    ...loan,
    schedules_summary: summary,
    recent_payments: recentPayments,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  const parsed = await parseBody(request, patchLoanSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (body.assigned_agent_id === undefined && body.status === undefined && body.notes === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    return await db.transaction(async (tx) => {
      const [loan] = await tx.execute(sql`
        SELECT id, status, assigned_agent_id, notes, loan_number
        FROM loans WHERE id = ${id} FOR UPDATE
      `) as unknown as any[]

      if (!loan) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
      }

      const updates: Record<string, unknown> = {}

      // Agent reassignment
      if (body.assigned_agent_id && body.assigned_agent_id !== loan.assigned_agent_id) {
        const [agent] = await tx.execute(sql`
          SELECT id FROM profiles WHERE id = ${body.assigned_agent_id} AND is_active = true
        `) as unknown as any[]
        if (!agent) {
          return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 400 })
        }
        // Close out current assignment
        await tx.execute(sql`
          UPDATE agent_loan_assignments
          SET is_current = false, unassigned_at = NOW()
          WHERE loan_id = ${id} AND is_current = true
        `)
        // Insert new
        await tx.execute(sql`
          INSERT INTO agent_loan_assignments (loan_id, agent_id, assigned_by, is_current, assigned_at)
          VALUES (${id}, ${body.assigned_agent_id}, ${actor.id}, true, NOW())
        `)
        updates.assigned_agent_id = body.assigned_agent_id
      }

      // Only CANCELLED allowed via this endpoint
      if (body.status === 'CANCELLED') {
        if (loan.status === 'CANCELLED') {
          return NextResponse.json({ error: 'Loan is already cancelled' }, { status: 400 })
        }
        updates.status = 'CANCELLED'
      }

      // Notes (null clears it)
      if (body.notes !== undefined) {
        updates.notes = body.notes
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nothing changed' }, { status: 400 })
      }

      const [updated] = await tx
        .update(loans)
        .set({ ...updates, updated_at: new Date() } as any)
        .where(eq(loans.id, id))
        .returning()

      await logAudit(tx as any, {
        actor_id: actor.id,
        actor_name: actor.name,
        actor_email: actor.email,
        action: 'UPDATE',
        entity_type: 'loan',
        entity_id: id,
        before_data: {
          status: loan.status,
          assigned_agent_id: loan.assigned_agent_id,
          notes: loan.notes,
        },
        after_data: updates,
        branch_id: actor.branch_id,
      })

      return NextResponse.json(updated)
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
