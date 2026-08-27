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
| ADMIN | Full access — loans, customers, employees, reports, collections, loan request approvals |
| COLLECTION_AGENT | Own assigned loans, customers, collections; can submit loan requests |
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
- Loan amount configured (e.g. ₹5,000)
- Interest deducted upfront (e.g. 10% = ₹500 → customer receives ₹4,500 but repays ₹5,000)
- Tenure (days) determines daily installment: daily installment = loan amount / tenure
- Penalty per missed day configurable (e.g. ₹50)
- Loan auto-closes (status → COMPLETED) when both principal and penalty outstanding = 0

**Flow:**
1. Agent submits loan request via their Loans page (existing or new customer)
2. Admin reviews pending requests on /admin/loan-requests, approves or rejects
3. On approval: new customer is created (if new), loan is created and assigned to agent automatically
4. System generates all daily repayment schedules automatically
5. Agent collects daily installments via their Loans page
6. Admin can collect lump-sum cash payments via loan detail → Collect Cash
7. Missed days auto-flagged by cron job, penalty generated (idempotent)

**Key financial equations:**
```
Interest Amount       = Loan Amount × Interest % / 100
Disbursed Amount      = Loan Amount - Interest Amount
Daily Installment     = Loan Amount / Tenure (days)
Principal Outstanding = Loan Amount - Principal Collected
Penalty Outstanding   = Generated - Paid - Waived
Total Outstanding     = Principal Outstanding + Penalty Outstanding
```

### Customer Outstanding Formula

The "amount owed" shown for every customer is always calculated live from the DB:
```
Outstanding = Opening Balance + Active Dues + Active Loan Outstanding - Confirmed Freeform Collections
```

- Opening Balance: starting debt when customer was added
- Active Dues: unpaid invoices (not PAID/CANCELLED)
- Active Loan Outstanding: total_outstanding across all active loans (principal + penalties)
- Freeform Collections: confirmed cash collections with no linked due

This formula is applied consistently in 5 places:
1. Admin customers page (SSR)
2. Agent customers page (SSR)
3. Admin customers API (after mutations)
4. Agent customers API (after mutations)
5. Freeform collection cap guard (POST /api/collections) — agent cannot collect more than this

### Loan Request Workflow

Agents can request loans for customers without admin access to the loan creation form.

**Agent side:**
- "Request Loan" button on the Loans page
- Toggle between existing customer or new customer (enter name/phone/area)
- Enter loan amount, interest %, tenure (days), penalty, disbursement date
- Daily installment auto-computed from loan amount / tenure with live preview
- Submitted requests show PENDING/APPROVED/REJECTED status in "My Loan Requests" section

**Admin side:**
- /admin/loan-requests page — filter by All/Pending/Approved/Rejected
- Each pending request shows full loan terms and customer details
- Approve: pick an agent to assign, system creates customer (if new) + loan automatically
- Reject: enter a reason, agent is notified

**Notifications:**
- Agent submits → admin bell shows "New Loan Request"
- Admin approves → agent bell shows "Loan Request Approved"

### Collections (Freeform)

General-purpose cash collection from customers against dues or freeform balances.

- Agent records collection (with GPS capture), selects customer and optionally a linked due
- Amount is capped at customer's outstanding balance — cannot over-collect
- Admin confirms or rejects with a reason
- Confirmed collections reduce the customer's outstanding immediately

### Customer Management

Customer profiles with GPS coordinates, assigned agent, branch, and opening balance.

Opening balance can only be adjusted via the dedicated "₹" button (requires reason, fully audited). Regular customer edits never touch the balance.

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

Both admin and agent have a notification bell:

- **Admin**: per-collection alerts ("John collected ₹500 from CustomerX"), plus live-computed aggregates (pending collections count, overdue dues, absent agents, pending reconciliations, pending expenses). Polled every 2 minutes.
- **Agent**: loan request approval/rejection notifications. Polled every 2 minutes.
- Dismissing a notification marks it read in DB — won't reappear.

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

### Manual DB migrations

Two additional migrations must be applied after `db:push`:

```bash
# Loan collection module (schedules, payments, penalties, agent assignments)
psql $DATABASE_URL -f lib/db/migrations/0003_daily_loan_collection.sql

# Loan requests table (agent → admin approval workflow)
psql $DATABASE_URL -c "
CREATE TYPE loan_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE IF NOT EXISTS loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  new_customer_name text, new_customer_phone text, new_customer_area text,
  loan_amount numeric(12,2) NOT NULL,
  interest_percentage numeric(5,2) NOT NULL DEFAULT 0,
  tenure integer,
  daily_installment numeric(12,2) NOT NULL,
  penalty_amount numeric(12,2) NOT NULL DEFAULT 0,
  disbursement_date date NOT NULL,
  notes text,
  status loan_request_status NOT NULL DEFAULT 'PENDING',
  requested_by uuid NOT NULL REFERENCES profiles(id),
  reviewed_by uuid REFERENCES profiles(id),
  rejection_reason text,
  created_loan_id uuid REFERENCES loans(id),
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS tenure integer;
"
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
  (auth)/              # login
  (dashboard)/
    admin/
      customers/       # admin customer list (outstanding = opening + dues + loans - freeform)
      loans/           # admin loan list + detail (schedule, payments, penalties)
      loan-requests/   # pending loan request approvals
      collections/     # confirm/reject agent collections
      ...
    loans/             # agent loan collection page (today's schedules)
    collections/       # agent freeform collections
    customers/         # agent customer list (same outstanding formula)
    dashboard/         # admin period-based analytics
  api/
    admin/
      dashboard/       # GET ?period=daily|monthly|yearly
      notifications/   # GET (aggregated + DB), PATCH (mark read)
      loan-requests/   # GET (list), PATCH /[id] (approve/reject)
      loans/           # CRUD + collect + bulk-collect + reverse + waive
      collections/     # confirm/reject
      customers/       # CRUD
    agent/
      loan-requests/   # GET (own), POST (submit)
      notifications/   # GET (own), PATCH (mark read)
      loans/           # GET (assigned), /[id]/collect (collect installment)
    cron/
      mark-missed/     # POST — marks overdue schedules, generates penalties

components/
  loans/               # admin + agent loan UI, loan request review
  customers/           # admin customer table + dialogs
  collections/         # collection form (agent) + admin table
  dashboard/           # self-fetching period dashboard
  notification-bell/   # shared bell (admin + agent, different endpoints)

lib/
  db/
    schema.ts          # full Drizzle schema (all tables + enums + relations)
    index.ts           # singleton postgres client (prevents HMR pool exhaustion)
  modules/
    loans/             # createLoan, updateLoanBalances, collectInstallment, reversePayment, waivePenalty
    collections/       # createCollection (with idempotency + SELECT FOR UPDATE)
    audit/             # append-only audit log
    ledger/            # append-only financial ledger
  auth/                # requireAdmin, requireAgent, requireRole, requireCustomerAccess
  validation/          # Zod schemas
```

## Architecture Notes

- All financial math uses integer cents to avoid float errors
- Every money-changing operation runs inside a DB transaction
- Loan + schedule rows are SELECT FOR UPDATE locked before payment to prevent double-collection
- Audit logs written atomically alongside every mutation
- Loan balances (principal_outstanding, total_outstanding) recalculated from payment records after every collection/reversal/waiver via `updateLoanBalances()` — never stored as running totals
- Customer outstanding is always computed at query time from source tables — never cached or pre-computed
- Notifications are fire-and-forget inserts — failure never blocks the main operation
- DB client is a global singleton to prevent connection pool exhaustion on Next.js HMR reloads
- Agent cannot collect more than customer's outstanding balance (enforced on both frontend and backend)
