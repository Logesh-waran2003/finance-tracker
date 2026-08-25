/**
 * Ledger service — canonical financial record.
 * Every money-changing operation must write a ledger entry atomically
 * within the same DB transaction.
 */
import { db } from '@/lib/db'
import { ledgerEntries } from '@/lib/db/schema'

// Accepts both db and a transaction object from db.transaction()
 
type AnyDB = { insert: (...args: any[]) => any }

export type LedgerParams = {
  entity_type: 'collection' | 'expense' | 'reconciliation'
  entity_id: string
  entry_type: 'CREDIT' | 'DEBIT' | 'RECONCILIATION' | 'REVERSAL'
  amount: string | number
  actor_id: string
  branch_id?: string | null
  notes?: string
}

/**
 * Writes a single ledger entry atomically.
 * Pass `tx` to run inside an existing transaction, or omit to use the global db.
 */
export async function writeLedgerEntry(
  txOrParams: AnyDB | LedgerParams,
  params?: LedgerParams,
): Promise<void> {
  let client: AnyDB
  let p: LedgerParams

  if (params !== undefined) {
    client = txOrParams as AnyDB
    p = params
  } else {
    client = db
    p = txOrParams as LedgerParams
  }

  await client.insert(ledgerEntries).values({
    entity_type: p.entity_type,
    entity_id: p.entity_id,
    entry_type: p.entry_type,
    amount: String(p.amount),
    actor_id: p.actor_id,
    branch_id: p.branch_id ?? null,
    notes: p.notes ?? null,
  })
}
