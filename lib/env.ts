/**
 * Environment variable validation.
 * Import this at the top of lib/db/index.ts and anywhere else that needs env vars.
 * Throws at startup if required variables are missing.
 */

const required = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
} as const
