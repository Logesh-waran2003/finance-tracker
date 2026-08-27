import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
// Validate required env vars at startup
import '@/lib/env'

const connectionString = process.env.DATABASE_URL!

// Singleton pattern — prevents new pools on every HMR reload in dev
const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> }

const client = globalForDb._pgClient ?? postgres(connectionString, { max: 5 })
if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
export type DB = typeof db
