# Finance Tracker

Collection & Staff Finance Tracker — built for field collection agencies. Full RBAC, attendance, collections workflow, cash reconciliation, expenses, and admin dashboard.

## Stack

- **Framework:** Next.js 16 App Router (TypeScript)
- **UI:** Tailwind CSS + shadcn/ui + Recharts
- **ORM:** Drizzle ORM
- **DB:** PostgreSQL (Docker)
- **Auth:** NextAuth v5 (credentials + JWT)

## Features

| Module | Description |
|---|---|
| Auth | Role-based login (ADMIN / COLLECTION_AGENT / STAFF) |
| Attendance | GPS check-in/out, LATE detection, admin correction, CSV export |
| Customers | CRUD, assigned agent, outstanding balance, activity timeline |
| Dues | Invoice-linked dues, outstanding tracking, status lifecycle |
| Collections | Agent collection form, GPS capture, idempotency, admin confirm/reject |
| Reconciliation | Daily cash handover, difference tracking, admin verification |
| Expenses | Claim submission, category-based, admin approve/reject |
| Dashboard | KPI cards, Recharts charts, aging report, activity feed |
| Reports | CSV exports — collections, attendance, expenses, reconciliation, dues |
| Notifications | Real-time alerts for pending collections, overdue dues, absent agents |

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
# Edit .env.local — set NEXTAUTH_SECRET and DATABASE_URL
```

### 4. Push schema and seed

```bash
bun run db:push
bun run db:seed
```

### 5. Start dev server

```bash
bun run dev
```

App runs at **http://localhost:3000** (or 3001 if 3000 is taken).

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
  db/             Drizzle schema + client
  auth.ts         Auth helpers (requireAuth, isAdmin, etc.)
```

## Scripts

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run type-check   # TypeScript check
bun run db:push      # Push schema to DB
bun run db:seed      # Seed demo data
```

## License

MIT
