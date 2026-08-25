# Finance Tracker

Collection & Staff Finance Tracker — built for field collection agencies. Full RBAC, attendance, collections workflow, cash reconciliation, expenses, admin dashboard, and production-grade security.

## Stack

- **Framework:** Next.js 16 App Router (TypeScript)
- **UI:** Tailwind CSS + shadcn/ui + Recharts
- **ORM:** Drizzle ORM
- **DB:** PostgreSQL (Docker, port 5433)
- **Auth:** NextAuth v5 (credentials + JWT)

## Features

| Module | Description |
|---|---|
| Auth | Role-based login (ADMIN / COLLECTION_AGENT / STAFF), session invalidation on password change |
| Attendance | GPS check-in/out, LATE detection, admin correction, CSV export |
| Customers | CRUD, assigned agent, outstanding balance, activity timeline |
| Dues | Invoice-linked dues, outstanding tracking, status lifecycle, state transition guards |
| Collections | Agent collection form, GPS capture, idempotency (ON CONFLICT DO NOTHING), admin confirm/reject |
| Reconciliation | Daily cash handover, server-side total calculation, difference tracking, admin verification |
| Expenses | Claim submission, category-based, admin approve/reject, state guards |
| Dashboard | KPI cards, Recharts charts, aging report, activity feed |
| Reports | CSV exports — collections, attendance, expenses, reconciliation, dues (injection-safe) |
| Notifications | Real-time alerts for pending collections, overdue dues, absent agents |
| Ledger | Atomic ledger entries on all financial events |
| Audit | Full audit log (jsonb) on all financial + security actions |

## Security

- Centralized server-side auth via `lib/auth/authorize.ts`
- IDOR fixed on dues, customers, collections, branches, notifications
- Session invalidated on password change (`password_version` in JWT)
- `requireAdmin` on every admin route with branch isolation
- Rate limiting on auth and change-password routes
- SELECT FOR UPDATE on due before collection (concurrent over-collection blocked)
- Amount > outstanding rejected with 400 (no silent clamping)
- `cash_collected` calculated server-side in reconciliation (client total ignored)
- Security headers: HSTS, X-Frame-Options, CSP, Permissions-Policy, Referrer-Policy
- CSV injection prevention
- Error responses never leak stack traces or DB errors
- Env validation at startup

## Local Setup

### Prerequisites
- Bun
- Docker

### 1. Clone and install

```bash
git clone https://github.com/Logesh-waran2003/finance-tracker.git
cd finance-tracker
bun install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — set NEXTAUTH_SECRET, NEXTAUTH_URL, DATABASE_URL
```

### 4. Run migrations and seed

```bash
bun run db:migrate   # apply Drizzle migrations (tracking table bootstrapped)
bun run db:seed
```

### 5. Start dev server

```bash
bun run dev          # localhost only
# or for WiFi access:
bun run dev -- --hostname 0.0.0.0
```

App runs at **http://localhost:3001**.
For WiFi access: **http://192.168.0.109:3001**

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | Demo@1234 |
| Agent | agent@demo.com | Demo@1234 |
| Staff | staff@demo.com | Demo@1234 |

## Database

PostgreSQL on port **5433** (avoids conflict with default 5432).

```
Host:     localhost:5433
Database: finance_tracker
User:     postgres
Password: postgres
```

## Project Structure

```
app/
  (auth)/         Login page
  (dashboard)/    All dashboard routes
    admin/        Admin-only pages
  api/            API routes (collections, attendance, expenses, etc.)
components/
  ui/             shadcn/ui base components
  attendance/     Check-in/out, admin attendance
  collections/    Collection form, admin table
  reconciliation/ Cash reconciliation
  expenses/       Expense claims
  reports/        CSV report downloads
  dashboard/      KPI dashboard
lib/
  auth/           authorize.ts — centralized server-side auth
  db/             Drizzle schema + client + migrations
  modules/        Service layer (collections, expenses, reconciliation, attendance, ledger, audit)
  validation/     Zod schemas
  rate-limit.ts   Rate limiting
  utils/          csv.ts, error.ts
```

## Scripts

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run type-check   # TypeScript check
bun run lint         # ESLint
bun run db:push      # Push schema to DB (dev only)
bun run db:migrate   # Apply Drizzle migrations (production)
bun run db:seed      # Seed demo data
```

## Changelog

### 2026-08-25 (Session 2)
- Mobile-first UI: all data tables replaced with card views on mobile, tables on sm+ breakpoint
  - Affected: collections, attendance, expenses, reconciliation, employees, customers (agent + admin views)
  - Customer detail dues table: mobile cards with amount/outstanding/penalty grid
  - Bottom navigation bar (role-aware, thumb-reachable, md:hidden, safe-area padding for notched phones)
  - Viewport meta tag added (was missing — mobile browsers were rendering at 980px)
  - min-h-screen → min-h-dvh across app-shell and auth layout (browser chrome fix)
  - Dashboard chart heights reduced for mobile
- Bug fix: confirming a collection now correctly reduces `outstanding_amount` on the linked due
  - Due status transitions to PARTIALLY_PAID or PAID on confirm (was stuck at original value forever)
- New feature: `penalty_rate` column on dues (% per month late fee, editable by admin)
- New feature: admin can edit `due_date` and `penalty_rate` via pencil icon on customer detail page
- Migration: `0002_due_penalty_rate.sql` — adds `penalty_rate NUMERIC(5,2)` to dues table
- WiFi dev access: `allowedDevOrigins` added to next.config.ts, `--hostname 0.0.0.0` flag

### 2026-08-25 (Session 1)
- Fixed Drizzle migration tracking — bootstrapped tracking table, added generated migration for all schema changes
- Added DB-level CHECK constraints for financial integrity
- Atomic idempotency for collections via ON CONFLICT DO NOTHING (eliminates SELECT-before-INSERT race)
- Decimal-safe money comparison in collection service (no parseFloat)
- Allow null `due_id` in createCollectionSchema (freeform collections)
- Fixed Drizzle relations for profiles -> branch (was crashing dashboard)
- Security hardening: centralized auth, IDOR fixes, rate limiting, session invalidation on password change
- Service layer extracted: collections, expenses, reconciliation, attendance, ledger, audit
- Ledger entries + audit logs on all financial/security events
- DB migrations: password_version, deleted_at, UNIQUE(agent_id, date) on reconciliations
- Security headers, CSV injection prevention, env validation at startup

## License

MIT
