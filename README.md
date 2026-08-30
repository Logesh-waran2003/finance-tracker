# Finance Tracker

A full-stack loan and collections management platform for field collection businesses. Built with Next.js 16, Drizzle ORM, PostgreSQL, and NextAuth.

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes (TypeScript)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: NextAuth v5 (credentials), 8-hour session auto-logout
- **Runtime**: Bun
- **Testing**: Vitest + bun:test, Robot Framework (E2E)

## Roles

| Role | Access |
|------|--------|
| ADMIN | Full access — loans, customers, employees, reports, collections, loan request approvals, settlement verify |
| COLLECTION_AGENT | All active loans (any branch), customers, collections; submit loan requests; cash settlement |
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
3. On approval: new customer is created (if new), loan is created and auto-assigned to requesting agent
4. System generates all daily repayment schedules automatically
5. Any agent can collect daily installments via the Loans page — collected amounts appear in My Collections
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

**Loan amount is immutable** — set once on creation, never changes regardless of payments.

### Customer Outstanding Formula

The "amount owed" shown for every customer is always calculated live from the DB:
```
Outstanding = Opening Balance + Active Dues + Active Loan Outstanding - Confirmed Freeform Collections
```

- Opening Balance: starting debt when customer was added
- Active Dues: unpaid invoices (not PAID/CANCELLED)
- Active Loan Outstanding: total_outstanding across all active loans (principal + penalties)
- Freeform Collections: confirmed cash collections with no linked due

Admin customer table shows both:
- **Loan Amount** = original fixed loan amount (sum of all active loans — never decreases)
- **Outstanding** = live remaining balance (decreases with every payment)

### Loan Request Workflow

Agents can request loans for customers without admin access to the loan creation form.

**Agent side:**
- "Request Loan" button on the Loans page
- Toggle between existing customer (any active customer) or new customer (enter name/phone/area)
- Enter loan amount, interest %, tenure (days), penalty, disbursement date
- Daily installment auto-computed from loan amount / tenure with live preview
- Submitted requests show PENDING/APPROVED/REJECTED status in "My Loan Requests" section

**Admin side:**
- /admin/loan-requests page — filter by All/Pending/Approved/Rejected
- Each pending request shows full loan terms and customer details
- Approve: system auto-assigns loan to the requesting agent, creates customer (if new) + loan
- Reject: enter a reason, agent is notified

**Notifications:**
- Agent submits → admin bell shows "New Loan Request"
- Admin approves → agent bell shows "Loan Request Approved — Loan LOAN-XXXXXX is now active"
- Admin approves → all branch admins notified with loan number
- View button on notification → routes directly to relevant page

### Collections (Freeform)

General-purpose cash collection from customers against dues or freeform balances.

- Agent records collection (with GPS capture), selects customer and optionally a linked due
- Amount is capped at customer's outstanding balance — cannot over-collect
- Admin confirms or rejects with a reason
- Confirmed collections reduce the customer's outstanding immediately

**My Collections page** shows both:
- Freeform collections (from collections table)
- Loan installment payments (from loan_payments table) — tagged with blue "Loan" badge
- Real status shown (PENDING/CONFIRMED/REJECTED) — not hardcoded
- Date filter to view collections by day

### Cash Settlement

Daily cash handover workflow between agent and admin (formerly Cash Reconciliation).

**Flow:**
1. Agent collects cash during the day (freeform collections + loan installments)
2. Settlement page shows:
   - **Confirmed Cash** = total CASH collected today (auto-calculated, read-only)
   - **Already Submitted** = cash already handed over today (excludes rejected)
   - **Pending Handover** = Confirmed Cash − Already Submitted
3. Agent submits cash handover — Cash Collected field is locked (server-calculated), only Cash Submitted is editable
4. Admin reviews and verifies or rejects
5. If rejected, Pending Handover is restored — agent can resubmit

**Notifications:**
- Agent submits → branch admins notified
- Admin verifies/rejects → agent notified

### Customer Management

Customer profiles with GPS coordinates, assigned agent, branch, and opening balance.

- Address field generates a live Google Maps link for location verification
- Opening balance can only be adjusted via the dedicated "₹" button (requires reason, fully audited)
- Regular customer edits never touch the balance
- Balance deductions reflect immediately in the outstanding calculation
- Customer detail page shows loans section with outstanding per loan

### My Customers (Agent)

Shows every customer the agent has submitted a loan request for.

- Two date filters: Requested Date and Disbursement Date (independent)
- View button opens customer detail page (allowed if agent collected from or requested loan for them)
- Customer detail shows dues, active loans, total outstanding

### Employees

Staff management with branch assignment, role control, and attendance tracking.

### Attendance

Daily check-in/check-out with GPS capture.

**Anti-spoofing measures:**
- `enableHighAccuracy: true` — forces GPS chip, not cell tower
- `maximumAge: 0` — no cached location
- Server rejects check-in if no GPS provided
- Server rejects if accuracy > 200m (cell tower / WiFi triangulation)
- Location denied → dialog with browser-specific step-by-step instructions to enable

**Admin view:**
- GPS column shows "📍 View Map" link — opens exact check-in location in Google Maps
- Accuracy shown in meters (orange if > 100m)
- Admin clicking "My Attendance" redirects directly to the admin view (no personal check-in)

**Dashboard attendance report:**
- Today's agent attendance table on admin dashboard: name, status badge, check-in time, map link

### Office Expenses

Employee expense submissions with category, approval workflow, and receipt upload (formerly My Expenses / Expenses Admin).

### Reports

Date-range reports for collections, dues, expenses, attendance, and reconciliation.

### Dashboard

Admin dashboard with period-based analytics — toggle between Daily, Monthly, and Yearly views.

- **KPI cards**: Total Outstanding, Collected, Collection %, Pending Reviews, Active Agents, Attendance Today
- **Collection trend chart**: Last 7 days (daily), last 30 days (monthly), or this year grouped by month (yearly)
- **Payment mode breakdown**: Bar chart by payment method for the selected period
- **Outstanding aging**: Buckets by overdue age — current, 1–30 days, 31–60 days, 60+ days
- **Recent activity**: Last 10 audit log entries
- **Today's Agent Attendance**: table of all active agents with status, check-in time, and GPS map link

### Notifications

Both admin and agent have a notification bell:

- **Admin**: per-collection alerts, loan request submissions, cash handover notifications, plus live-computed aggregates. Polled every 2 minutes. View button routes to the relevant page.
- **Agent**: loan request approval/rejection, cash handover verify/reject. Polled every 2 minutes.
- Dismissing a notification marks it read in DB — won't reappear.

### Branch Management

Admin can create and edit branches via Settings → Branches.

- Each branch shows a Google Maps link built from address + city
- Edit button opens a dialog with all fields editable
- Office GPS location can be set per branch: enter lat/lng manually or use "Use my current location" button
- Location denied → dialog with browser-specific instructions to enable

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
bun run db:setup         # apply schema + triggers + seed in sequence
bun run dev              # start dev server on port 3001
```

> **Note:** `db:setup` runs `db:push` + `db:triggers` + `seed` in sequence. Skipping `db:triggers` will silently break outstanding_amount recalculation, collection_number generation, and attendance hour tracking — all implemented as Postgres triggers.

For WiFi hosting:

```bash
NEXTAUTH_URL=http://192.168.0.109:3001 bun run dev -- --hostname 0.0.0.0 --port 3001
```

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
ALTER TABLE branches ADD COLUMN IF NOT EXISTS office_lat numeric(10,7);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS office_lng numeric(10,7);
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

### Unit tests

```bash
bun test               # run all tests
bun test --watch       # watch mode
```

169 tests across 6 files covering financial calculations, business rules, service logic, security hardening, and API validation.

### E2E tests (Robot Framework)

```bash
# First time setup
uv venv .venv-robot
source .venv-robot/bin/activate
uv pip install robotframework robotframework-browser robotframework-requests
rfbrowser init

# Run all suites (headless)
bash tests/robot/run.sh

# Run a specific suite
bash tests/robot/run.sh 01_auth

# Run with visible browser
bash tests/robot/run.sh --headed
```

36 tests across 4 suites:
- `01_auth` — login valid/invalid, redirect if authenticated, logout
- `02_admin` — all admin pages, dashboard period toggle, notification bell, create loan dialog
- `03_agent` — all agent pages, outstanding column, request loan dialog, access control
- `04_loan_collection_workflow` — agent submits loan request, admin approves, collection form

Results in `tests/robot/results/report.html` after a run.

## Project Structure

```
app/
  (auth)/              # login
  (dashboard)/
    admin/
      customers/       # admin customer list (loan_amount_total + loan_outstanding_total)
      loans/           # admin loan list + detail (schedule, payments, penalties)
      loan-requests/   # pending loan request approvals
      collections/     # confirm/reject agent collections
      reconciliation/  # verify/reject cash handover (Settlement)
      attendance/      # view all agent attendance + GPS map links
      settings/        # company settings + branch management
      ...
    loans/             # agent loan collection page (today's schedules + loan requests)
    collections/       # agent freeform + loan installment collections merged (date filter)
    reconciliation/    # agent cash settlement submission
    customers/         # agent customer list (loan-requested customers + date filters)
    attendance/        # agent check-in/check-out (GPS required, anti-spoofing)
    expenses/          # office expense submission
    dashboard/         # admin period-based analytics
  api/
    admin/
      dashboard/       # GET ?period=daily|monthly|yearly (includes agent attendance)
      notifications/   # GET (aggregated + DB), PATCH (mark read)
      loan-requests/   # GET (list), PATCH /[id] (approve/reject + notifications)
      loans/           # CRUD + collect + bulk-collect + reverse + waive
      collections/     # confirm/reject
      customers/       # CRUD
      reconciliation/  # GET (list), PATCH /[id] (verify/reject + notifications)
      branches/        # CRUD + office GPS
    agent/
      loan-requests/   # GET (own), POST (submit)
      notifications/   # GET (own), PATCH (mark read)
      loans/           # GET (all active), /[id]/collect (collect installment)
    attendance/
      checkin/         # POST — GPS required, accuracy ≤ 200m enforced
      checkout/        # POST
    cron/
      mark-missed/     # POST — marks overdue schedules, generates penalties

components/
  loans/               # admin + agent loan UI, loan request review
  customers/           # admin customer table + dialogs
  collections/         # collection form (agent) — freeform + loan payments merged
  reconciliation/      # cash handover submit + history
  notification-bell/   # shared bell (admin + agent, different endpoints + routing)
  attendance/          # agent check-in/check-out + admin attendance view
  expenses/            # office expense form (agent + admin)
  dashboard/           # admin analytics client
  admin/               # branches panel, company settings
  ui/
    gmaps-link.tsx           # reusable Google Maps link from address text
    location-denied-dialog/  # browser-specific GPS enable instructions

lib/
  db/
    schema.ts          # full Drizzle schema (all tables + enums + relations)
    index.ts           # singleton postgres client (prevents HMR pool exhaustion)
  modules/
    loans/             # createLoan, updateLoanBalances, collectInstallment, reversePayment, waivePenalty
    collections/       # createCollection (with idempotency + SELECT FOR UPDATE)
    reconciliation/    # createReconciliation (server-calc cash), verifyReconciliation
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
- Loan amount is immutable — fixed at creation, includes interest upfront
- Cash reconciliation cash_collected is always server-calculated — never trusted from client
- Notifications are fire-and-forget inserts — failure never blocks the main operation
- DB client is a global singleton to prevent connection pool exhaustion on Next.js HMR reloads
- Agent cannot collect more than customer's outstanding balance (enforced on both frontend and backend)
- Rate limiter bypasses private network IPs (192.168.x.x, 10.x.x.x) for dev/test environments
- Any agent can collect any active loan — no per-agent assignment restriction
- GPS accuracy > 200m rejected on server — blocks cell tower check-ins
