/**
 * Collections service — core business logic for recording customer payments.
 * Receives a DB instance (or transaction) and typed inputs.
 * No NextRequest, no session — auth stays in the route layer.
 */
import { collections } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { logAudit } from '@/lib/modules/audit/service'
import { ServiceError } from '@/lib/modules/errors'
import { toCents } from '@/lib/utils/money'

// Accepts both db and a tx from db.transaction()
 
type AnyDB = { insert: (...a: any[]) => any; select: (...a: any[]) => any; execute: (...a: any[]) => any; transaction: (...a: any[]) => any }

export type CreateCollectionParams = {
  agentId: string
  branchId: string | null
  actorName: string
  actorEmail: string
  customerId: string
  dueId?: string
  amount: number
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'
  paymentReference?: string
  notes?: string
  gpsLat?: number
  gpsLng?: number
  gpsAccuracy?: number
  idempotencyKey?: string
}

export type CollectionResult =
  | { collection: typeof collections.$inferSelect; created: true }
  | { collection: typeof collections.$inferSelect; created: false }

/**
 * Records a collection payment inside a single DB transaction.
 *
 * Business rules enforced:
 * - Agent must be assigned to the customer (callers must verify via requireCustomerAccess before calling)
 * - If due_id provided: due must exist, belong to customer, be non-terminal, and amount <= outstanding
 * - Idempotency: if idempotency_key already exists, returns existing record without inserting
 * - SELECT FOR UPDATE on due prevents concurrent over-collection
 */
export async function createCollection(
  db: AnyDB,
  params: CreateCollectionParams,
): Promise<CollectionResult> {
  return (db as any).transaction(async (tx: AnyDB) => {
    // Due validation — locked for update to prevent concurrent over-collection
    if (params.dueId) {
      const [due] = await (tx as any).execute(
        sql`SELECT id, customer_id, outstanding_amount, status FROM dues WHERE id = ${params.dueId} FOR UPDATE`,
      ) as any[]

      if (!due) throw new ServiceError('Due not found', 404)
      if (due.customer_id !== params.customerId) {
        throw new ServiceError('Due does not belong to this customer', 400)
      }
      if (due.status === 'PAID' || due.status === 'CANCELLED') {
        throw new ServiceError(`Cannot collect on a ${due.status} due`, 400)
      }
      // Decimal-safe money comparison — convert to integer cents, no float arithmetic
      const outstandingCents = toCents(due.outstanding_amount ?? '0')
      const amountCents = toCents(params.amount)
      if (amountCents > outstandingCents) {
        throw new ServiceError(
          `Amount (${params.amount}) exceeds outstanding balance (${due.outstanding_amount})`,
          400,
        )
      }
    }

    // Atomic idempotency via ON CONFLICT DO NOTHING — DB unique constraint on
    // idempotency_key serializes concurrent requests. No SELECT-then-INSERT race.
    const insertResult = await (tx as any)
      .insert(collections)
      .values({
        customer_id: params.customerId,
        due_id: params.dueId ?? null,
        agent_id: params.agentId,
        branch_id: params.branchId,
        amount: String(params.amount),
        payment_mode: params.paymentMode,
        payment_reference: params.paymentReference ?? null,
        notes: params.notes ?? null,
        gps_lat: params.gpsLat != null ? String(params.gpsLat) : null,
        gps_lng: params.gpsLng != null ? String(params.gpsLng) : null,
        gps_accuracy: params.gpsAccuracy != null ? String(params.gpsAccuracy) : null,
        status: 'PENDING',
        idempotency_key: params.idempotencyKey ?? null,
        collected_at: new Date(),
      })
      .onConflictDoNothing({ target: collections.idempotency_key })
      .returning()

    // If nothing was returned, the row already existed — fetch and return it
    if (!insertResult || insertResult.length === 0) {
      const existing = await (tx as any)
        .select()
        .from(collections)
        .where(eq(collections.idempotency_key, params.idempotencyKey!))
        .limit(1)
        .then((r: any[]) => r[0])
      return { collection: existing, created: false }
    }

    const collection = insertResult[0]

    await logAudit(tx, {
      actor_id: params.agentId,
      actor_name: params.actorName,
      actor_email: params.actorEmail,
      action: 'CREATE',
      entity_type: 'collection',
      entity_id: collection.id,
      after_data: {
        collection_number: collection.collection_number,
        amount: collection.amount,
        payment_mode: collection.payment_mode,
        status: collection.status,
      },
      branch_id: params.branchId,
    })

    return { collection, created: true }
  })
}
