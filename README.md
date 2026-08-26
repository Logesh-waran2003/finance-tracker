# Finance Tracker

A full-stack loan and collections management platform for field collection businesses. Built with Next.js 16, Drizzle ORM, PostgreSQL, and NextAuth.

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes (TypeScript)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: NextAuth v5 (credentials)
- **Runtime**: Bun
- **Testing**: Vitest + bun:test

## Roles

| Role | Access |
|------|--------|
| ADMIN | Full access — loans, customers, employees, reports, collections |
| COLLECTION_AGENT | Own assigned loans and customers only |
| STAFF | Attendance and expenses only |

## Default Logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | Demo@1234 |
| Agent | agent@demo.com | Demo@1234 |
| Staff | staff@demo.com | Demo@1234 |

## Core Modules

### Daily Loan Collection

The primary business module. Manages the full lifecycle of micro-finance loans with daily installment collection.

**Loan model:**
- Loan amount configured by admin (e.g. ₹10,000)
- Interest deducted upfront (e.g. 10% = ₹1,000)
- Customer receives disbursed amount (₹9,000) but repays full loan amount (₹10,000)
- Daily installment configurable per loan (e.g. ₹50/day)
- Penalty per missed day configurable (e.g. ₹50)

**Flow:**
1. Admin creates loan, assigns agent, sets disbursement date
2. System generates all daily repayment schedules automatically
3. Agent collects daily installments via their Loans page
4. Admin can collect lump-sum cash payments via loan detail → Collect Cash
5. Missed days auto-flagged by cron job, penalty generated (idempotent)
6. Loan auto-closes when principal outstanding = 0

**Key financial equations:**
```
Interest Amount = Loan Amount × Interest % / 100
Disbursed Amount = Loan Amount - Interest Amount
Principal Outstanding = Loan Amount - Principal Collected (NOT disbursed amount)
Penalty Outstanding = Generated - Paid - Waived
Total Outstanding = Principal Outstanding + Penalty Outstanding
```

### Collections (Freeform)

General-purpose cash collection from customers against dues or freeform balances. Agent creates collection → Admin confirms/rejects.

### Customer Management

Customer profiles with GPS coordinates, assigned agent, opening balance (starting debt), and full outstanding calculation:
```
Outstanding = Opening Balance + Active Dues - Confirmed Freeform Collections
```

Opening balance can only be adjusted via the dedicated "₹" button (requires reason, fully audited). Regular customer edits never touch outstanding balance.

### Employees

Staff management with branch assignment, role control, and attendance tracking.

### Attendance

Daily check-in/check-out with GPS capture. Admins can view and correct attendance records.

### Expenses

Employee expense submissions with category, approval workflow, and receipt upload.

### Reconciliation

Daily cash reconciliation — agent submits cash collected vs cash submitted. Admin verifies.

### Reports

Date-range reports for collections, dues, expenses, attendance, and reconciliation.

### Dashboard

Admin dashboard with period-based analytics — toggle between Daily, Monthly, and Yearly views.

- **KPI cards**: Total Outstanding, Collected, Collection %, Pending Reviews, Active Agents, Attendance Today
- **Collection trend chart**: Last 7 days (daily), last 30 days (monthly), or this year grouped by month (yearly)
- **Payment mode breakdown**: Bar chart by payment method for the selected period
- **Outstanding aging**: Buckets by overdue age — current, 1–30 days, 31–60 days, 60+ days
- **Recent activity**: Last 10 audit log entries

### Notifications

Admin bell shows two types of alerts:

1. **Individual alerts** (from `notifications` table): per-collection notifications when an agent submits a collection — "John collected ₹500 from CustomerX — pending your confirmation". Dismissing marks it read in DB.
2. **Aggregate alerts** (live-computed): pending collections count, overdue dues, absent agents, pending reconciliations, pending expense claims. Polled every 2 minutes.

## Setup

### Prerequisites

- PostgreSQL 14+
- Bun 1.x
- Node 20+

### Environment

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://user:***@localhost:5432/finance_tracker
NEXTAUTH_SECRET=your-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3001
CRON_SECRET=your-cron-secret   # optional, secures the /api/cron/mark-missed endpoint
```

For WiFi access replace localhost with your machine's local IP (e.g. 192.168.0.109).

### Install and run

```bash
bun install
bun run db:push          # apply schema to DB
bun run db:triggers      # apply DB triggers
bun run seed             # create default users
bun run dev              # start dev server on port 3001
```

For WiFi hosting:

```bash
bun run dev -- --hostname 0.0.0.0 --port 3001
```

Set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to your WiFi IP when hosting on LAN.

### Database migrations

Manual migrations live in `lib/db/migrations/`. Apply them in order:

```bash
psql $DATABASE_URL -f lib/db/migrations/0003_daily_loan_collection.sql
```

### Production build

```bash
bun run build
bun run start -- --hostname 0.0.0.0 --port 3001
```

## Cron Job

Mark missed loan schedules and generate penalties daily:

```
POST /api/cron/mark-missed
Header: x-cron-secret: <CRON_SECRET>
```

Set up a system cron or Vercel cron to call this once per day after midnight IST.

Example crontab (runs at 12:05 AM IST = 6:35 PM UTC):

```cron
35 18 * * * curl -s -X POST https://yourdomain.com/api/cron/mark-missed -H "x-cron-secret: your-secret"
```

The job is fully idempotent — running it twice never creates duplicate penalties.

## Tests

```bash
bun test               # run all tests
bun test --watch       # watch mode
```

166 tests across 5 files covering financial calculations, business rules, service logic, security hardening, and API validation.

## Project Structure

```
app/
  (auth)/              # login, forgot/reset password
  (dashboard)/
    admin/             # admin pages (customers, employees, loans, collections, etc.)
    loans/             # agent loan collection page
    collections/       # agent freeform collections
    customers/         # agent customer list and detail
    dashboard/         # admin dashboard (period-based analytics)
    ...
  api/
    admin/
      dashboard/       # GET /api/admin/dashboard?period=daily|monthly|yearly
      notifications/   # GET (aggregated + DB notifications), PATCH (mark read)
      collections/     # collection confirm/reject
      ...
    agent/             # agent-scoped API routes
    cron/              # scheduled job endpoints

components/
  loans/               # loan module UI components
  customers/           # customer management components
  collections/         # collection form and admin table
  dashboard/           # dashboard-client (self-fetching, period toggle)
  notification-bell/   # admin notification bell
  ui/                  # shadcn/ui base components

lib/
  db/
    schema.ts          # full Drizzle schema
    migrations/        # SQL migration files
  modules/
    loans/             # loan service, schedule service, payment service
    collections/       # collections service
    audit/             # audit log service
    ledger/            # ledger entry service
  auth/                # authorization middleware
  validation/          # Zod schemas
```

## Architecture Notes

- All financial math uses integer cents to avoid float errors
- Every money-changing operation runs inside a DB transaction
- Audit logs written atomically alongside every mutation
- Opening balance on customers is a one-time setup field — outstanding is always calculated dynamically at query time
- Loan balances (principal_collected, principal_outstanding) are maintained on the loans table and recalculated after every payment/reversal/waiver via `updateLoanBalances()`
- Concurrency: loan and schedule rows are SELECT FOR UPDATE locked before payment to prevent double-collection
- Notifications table is written on every agent collection (fire-and-forget); admin bell reads both live-computed aggregates and unread DB rows, combining them in one response
- Dashboard data fetched client-side per period selection — no SSR data fetching for the admin dashboard view
