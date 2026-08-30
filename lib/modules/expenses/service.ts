/**
 * Expenses service — business logic for expense creation and admin approval.
 * No NextRequest, no session — auth stays in the route layer.
 */
import { expenses, expenseCategories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
import { writeLedgerEntry } from '@/lib/modules/ledger/service'
import { ServiceError } from '@/lib/modules/errors'


type AnyDB = { insert: (...a: any[]) => any; select: (...a: any[]) => any; update: (...a: any[]) => any; transaction: (...a: any[]) => any }

export type CreateExpenseParams = {
  userId: string
  branchId: string | null
  actorName: string
  actorEmail: string
  categoryId: string
  amount: number
  paymentMode?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'
  description: string
  expenseDate: string
  idempotencyKey?: string
}

export type ApproveExpenseParams = {
  expenseId: string
  adminId: string
  adminBranchId: string | null
  actorName: string
  actorEmail: string
  action: 'APPROVED' | 'REJECTED'
  reason?: string
}

/**
 * Creates a new expense in PENDING status.
 * Verifies the category exists server-side.
 * Idempotency: if idempotency_key already exists, returns the existing record.
 */
export async function createExpense(
  db: AnyDB,
  params: CreateExpenseParams,
): Promise<typeof expenses.$inferSelect> {
  // Verify category exists
  const cat = await (db as any)
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(eq(expenseCategories.id, params.categoryId))
    .limit(1)
    .then((r: any[]) => r[0])
  if (!cat) throw new ServiceError('Expense category not found', 404)

  const values = {
    category_id: params.categoryId,
    employee_id: params.userId,
    branch_id: params.branchId,
    amount: String(params.amount),
    payment_mode: params.paymentMode ?? 'CASH',
    description: params.description,
    expense_date: params.expenseDate,
    status: 'PENDING' as const,
    idempotency_key: params.idempotencyKey ?? null,
  }

  let expense: typeof expenses.$inferSelect

  if (params.idempotencyKey) {
    // Idempotent path — ON CONFLICT DO NOTHING on the unique key
    const insertResult = await (db as any)
      .insert(expenses)
      .values(values)
      .onConflictDoNothing({ target: expenses.idempotency_key })
      .returning()

    if (!insertResult || insertResult.length === 0) {
      const existing = await (db as any)
        .select()
        .from(expenses)
        .where(eq(expenses.idempotency_key, params.idempotencyKey))
        .limit(1)
        .then((r: any[]) => r[0])
      return existing
    }
    expense = insertResult[0]
  } else {
    // No idempotency key — plain insert
    const [row] = await (db as any).insert(expenses).values(values).returning()
    expense = row
  }

  await logAudit(db, {
    actor_id: params.userId,
    actor_name: params.actorName,
    actor_email: params.actorEmail,
    action: 'CREATE',
    entity_type: 'expense',
    entity_id: expense.id,
    after_data: {
      amount: params.amount,
      description: params.description,
      expense_date: params.expenseDate,
    },
    branch_id: params.branchId,
  })

  return expense
}

/**
 * Approves or rejects a PENDING expense inside a DB transaction.
 * Only PENDING expenses may be actioned.
 * Approval writes a DEBIT ledger entry.
 */
export async function approveExpense(
  db: AnyDB,
  params: ApproveExpenseParams,
): Promise<typeof expenses.$inferSelect> {
  const expense = await (db as any)
    .select()
    .from(expenses)
    .where(eq(expenses.id, params.expenseId))
    .limit(1)
    .then((r: any[]) => r[0])

  if (!expense) throw new ServiceError('Expense not found', 404)

  // IDOR: branch isolation — branch-scoped admin cannot action another branch's expense
  if (params.adminBranchId && expense.branch_id !== params.adminBranchId) {
    throw new ServiceError('Expense not found', 404)
  }

  if (expense.status !== 'PENDING') {
    throw new ServiceError('Only PENDING expenses can be actioned', 400)
  }

  const now = new Date()
  const isApproval = params.action === 'APPROVED'
  const updates: Record<string, unknown> = { updated_at: now }

  if (isApproval) {
    updates.status = 'APPROVED'
    updates.approved_by = params.adminId
    updates.approved_at = now
  } else {
    updates.status = 'REJECTED'
    updates.rejection_reason = params.reason
  }

  return (db as any).transaction(async (tx: AnyDB) => {
    const [updated] = await (tx as any)
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, params.expenseId))
      .returning()

    await logAudit(tx, {
      actor_id: params.adminId,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: isApproval ? 'APPROVE' : 'REJECT',
      entity_type: 'expense',
      entity_id: params.expenseId,
      before_data: { status: expense.status },
      after_data: { status: updated.status },
      branch_id: params.adminBranchId,
    })

    if (isApproval) {
      await writeLedgerEntry(tx, {
        entity_type: 'expense',
        entity_id: params.expenseId,
        entry_type: 'DEBIT',
        amount: expense.amount,
        actor_id: params.adminId,
        branch_id: expense.branch_id,
        notes: `Expense approved: ${expense.description}`,
      })
    }

    return updated
  })
}
