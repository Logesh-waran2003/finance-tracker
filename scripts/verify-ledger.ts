#!/usr/bin/env bun
/**
 * Ledger reconciliation script.
 * Checks that ledger CREDIT entries for each due match
 * due.amount - due.outstanding_amount.
 *
 * Run: bun run verify:ledger
 */
import { db } from '../lib/db'
import { dues, ledgerEntries } from '../lib/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'

async function main() {
  const allDues = await db.select({
    id: dues.id,
    amount: dues.amount,
    outstanding_amount: dues.outstanding_amount,
    status: dues.status,
  }).from(dues).where(isNull(dues.deleted_at))

  let drifts = 0
  for (const due of allDues) {
    const [ledgerSum] = await db.select({
      total: sql<string>`coalesce(sum(${ledgerEntries.amount}), '0')`
    }).from(ledgerEntries)
      .where(and(
        eq(ledgerEntries.entity_type, 'collection'),
        eq(ledgerEntries.entry_type, 'CREDIT'),
        sql`${ledgerEntries.entity_id} IN (
          SELECT id FROM collections WHERE due_id = ${due.id} AND status = 'CONFIRMED'
        )`
      ))

    const expectedPaid = Math.round((parseFloat(due.amount) - parseFloat(due.outstanding_amount)) * 100)
    const actualLedger = Math.round(parseFloat(ledgerSum?.total ?? '0') * 100)

    if (Math.abs(expectedPaid - actualLedger) > 1) {
      console.error(`DRIFT on due ${due.id}: expected_paid=${expectedPaid}c ledger=${actualLedger}c status=${due.status}`)
      drifts++
    }
  }

  if (drifts === 0) {
    console.log(`✓ Ledger reconciliation passed — ${allDues.length} dues checked, no drift`)
  } else {
    console.error(`✗ ${drifts} drift(s) found`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
