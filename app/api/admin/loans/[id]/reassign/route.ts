import { db } from '@/lib/db'
import { loans, agentLoanAssignments } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireAdmin, isResponse } from '@/lib/auth/authorize'
import { logAudit } from '@/lib/modules/audit/service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrRes = await requireAdmin()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const { id } = await params

  try {
    const { agent_id } = await request.json()
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

    await db.transaction(async (tx) => {
      // Close existing current assignment
      await tx
        .update(agentLoanAssignments)
        .set({ is_current: false, unassigned_at: new Date() })
        .where(eq(agentLoanAssignments.loan_id, id))

      // Update loan assigned_agent
      await tx
        .update(loans)
        .set({ assigned_agent_id: agent_id, updated_at: new Date() })
        .where(eq(loans.id, id))

      // New assignment record
      await tx.insert(agentLoanAssignments).values({
        loan_id: id,
        agent_id,
        assigned_by: actor.id,
        is_current: true,
        assigned_at: new Date(),
      })

      await logAudit(tx as any, {
        actor_id: actor.id,
        actor_name: actor.name,
        actor_email: actor.email,
        action: 'REASSIGN_AGENT',
        entity_type: 'loan',
        entity_id: id,
        after_data: { new_agent_id: agent_id },
        branch_id: actor.branch_id,
      })
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/admin/loans/[id]/reassign]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
