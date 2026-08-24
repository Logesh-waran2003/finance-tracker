import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'

async function applyTriggers() {
  const url = process.env.DATABASE_URL!
  const sql = postgres(url)

  console.log('Applying DB triggers...')
  const triggerSQL = readFileSync(join(process.cwd(), 'lib/db/triggers.sql'), 'utf-8')

  // Run the whole file as one block — don't split multi-statement functions
  await sql.unsafe(triggerSQL)
  console.log('Triggers applied.')
  await sql.end()
  process.exit(0)
}

applyTriggers().catch(err => { console.error(err); process.exit(1) })
