/**
 * Audit service — write immutable audit records.
 * Must be called within the same DB transaction as the operation being audited.
 */
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

// Accepts both db and a transaction object from db.transaction()
 
type AnyDB = { insert: (...args: any[]) => any }

export type AuditParams = {
  actor_id: string
  actor_name: string
  actor_email?: string
  action: string
  entity_type: string
  entity_id?: string | null
  before_data?: Record<string, unknown> | null
  after_data?: Record<string, unknown> | null
  ip_address?: string | null
  user_agent?: string | null
  branch_id?: string | null
}

/**
 * Writes a single audit record atomically.
 * Pass `tx` to run inside an existing transaction, or omit to use the global db.
 */
export async function logAudit(
  txOrParams: AnyDB | AuditParams,
  params?: AuditParams,
): Promise<void> {
  let client: AnyDB
  let p: AuditParams

  // Overload: logAudit(tx, params) or logAudit(params)
  if (params !== undefined) {
    client = txOrParams as AnyDB
    p = params
  } else {
    client = db
    p = txOrParams as AuditParams
  }

  await client.insert(auditLogs).values({
    actor_id: p.actor_id,
    actor_name: p.actor_name,
    actor_email: p.actor_email ?? null,
    action: p.action,
    entity_type: p.entity_type,
    entity_id: p.entity_id ?? null,
    before_data: p.before_data ?? null,
    after_data: p.after_data ?? null,
    ip_address: p.ip_address ?? null,
    user_agent: p.user_agent ?? null,
    branch_id: p.branch_id ?? null,
  })
}
