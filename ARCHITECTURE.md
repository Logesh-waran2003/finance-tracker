# Finance Tracker — Architecture Overview

> For beginners: this document explains what every folder does and how data flows through the app.

---

## How the App Works (Big Picture)

```
User's Phone/Browser
        ↓
    Next.js App  (this repo)
        ↓
    PostgreSQL Database  (stores all data permanently)
```

When a user opens the app, their browser talks to the Next.js server. The server reads/writes data in PostgreSQL and sends back what to display.

---

## User Roles

| Role | What they can do |
|------|-----------------|
| **ADMIN** | Approve/reject everything. View all reports. Manage employees, branches, customers. |
| **COLLECTION_AGENT** | Check in, collect money from customers, submit loan requests, submit cash settlement. |
| **STAFF** | Mark attendance, submit expenses only. |

---

## System Flow

### Agent's Day
```
1. Open app → Log in
2. Mark Attendance (GPS required)
3. Visit customers → Record Collections
4. Request loans for customers (admin approves)
5. End of day → Submit Cash Settlement
```

### Admin's Day
```
1. Open Dashboard → See who checked in, what's pending
2. Review pending Collections → Confirm or Reject
3. Review Loan Requests → Approve or Reject
4. Verify Cash Settlements from agents
5. Approve/Reject Expense claims
6. View Reports
```

---

## Folder Structure — What Each Folder Does

```
finance-tracker/
│
├── app/                         THE WHOLE APPLICATION
│   │
│   ├── (auth)/                  BEFORE LOGIN
│   │   └── login/               Login page
│   │
│   ├── (dashboard)/             AFTER LOGIN — all pages
│   │   ├── layout.tsx           Wraps every page (nav bar, idle logout)
│   │   ├── dashboard/           Home dashboard
│   │   ├── admin/               Admin-only pages
│   │   │   ├── customers/       Manage all customers
│   │   │   ├── loans/           View/manage all loans
│   │   │   ├── loan-requests/   Approve/reject agent loan requests
│   │   │   ├── collections/     Confirm/reject agent collections
│   │   │   ├── reconciliation/  Verify cash settlements (Settlement)
│   │   │   ├── employees/       Manage staff
│   │   │   ├── attendance/      View all agent attendance + GPS
│   │   │   ├── expenses/        Approve/reject expense claims
│   │   │   ├── reports/         Financial reports
│   │   │   └── settings/        Company + branch settings
│   │   │
│   │   ├── loans/               Agent: view loans, collect installments, request new loans
│   │   ├── collections/         Agent: record freeform cash collections
│   │   ├── reconciliation/      Agent: submit daily cash handover (Cash Settlement)
│   │   ├── customers/           Agent: view customers they've worked with
│   │   ├── attendance/          Agent: check in / check out
│   │   └── expenses/            Agent + Admin: office expense submissions
│   │
│   └── api/                     BACKEND — handles data requests
│       ├── admin/               Admin-only API endpoints
│       │   ├── loans/           Loan CRUD + collect + reverse + waive
│       │   ├── loan-requests/   Approve/reject loan requests
│       │   ├── collections/     Confirm/reject collections
│       │   ├── customers/       Customer CRUD
│       │   ├── reconciliation/  Verify/reject settlements
│       │   ├── expenses/        Approve/reject expenses
│       │   ├── attendance/      View + correct attendance
│       │   ├── branches/        Branch management
│       │   ├── notifications/   Admin notifications
│       │   ├── reports/         Report generation
│       │   └── dashboard/       Dashboard data (KPIs, charts, attendance)
│       │
│       ├── agent/               Agent-only API endpoints
│       │   ├── loans/           Agent's active loans
│       │   ├── loan-requests/   Submit/view loan requests
│       │   └── notifications/   Agent notifications
│       │
│       ├── attendance/          Check in / check out
│       ├── collections/         Record a collection
│       ├── expenses/            Submit an expense
│       ├── reconciliation/      Submit cash settlement
│       └── auth/logout/         Clear session on tab close
│
├── components/                  UI PIECES (what users see and interact with)
│   ├── loans/                   Loan tables, dialogs, request forms
│   ├── collections/             Collection form with GPS
│   ├── reconciliation/          Cash settlement form
│   ├── customers/               Customer tables, detail dialogs
│   ├── employees/               Employee management table
│   ├── attendance/              Check in/out UI + admin attendance view
│   ├── expenses/                Expense form (agent) + admin approval table
│   ├── reports/                 Report tables
│   ├── dashboard/               Charts, KPI cards
│   ├── admin/                   Branch management, company settings
│   ├── notification-bell.tsx    Bell icon with notification panel
│   ├── app-shell.tsx            Main layout (sidebar nav + top bar)
│   ├── bottom-nav.tsx           Mobile bottom navigation
│   ├── idle-logout.tsx          Auto-logout after 2 min idle
│   └── ui/                      Generic reusable components (buttons, inputs, dialogs)
│
├── lib/                         BRAIN — business logic and data access
│   │
│   ├── db/
│   │   ├── schema.ts            ALL DATABASE TABLES defined here
│   │   │                        (customers, loans, collections, dues, etc.)
│   │   └── index.ts             Database connection (single instance)
│   │
│   ├── modules/                 BUSINESS RULES — how money moves
│   │   ├── loans/
│   │   │   ├── service.ts       Create loan, generate schedules
│   │   │   └── payment-service.ts  Collect installment, reverse, waive
│   │   ├── collections/
│   │   │   └── service.ts       Record collection (SELECT FOR UPDATE, idempotency)
│   │   ├── reconciliation/
│   │   │   └── service.ts       Submit/verify cash handover
│   │   ├── expenses/
│   │   │   └── service.ts       Create/approve expense + ledger entry
│   │   ├── audit/
│   │   │   └── service.ts       Append-only audit log (who did what when)
│   │   ├── ledger/
│   │   │   └── service.ts       Append-only financial ledger (CREDIT/DEBIT/REVERSAL)
│   │   ├── attendance/
│   │   │   └── service.ts       Check in / check out
│   │   └── errors.ts            ServiceError (structured errors from business layer)
│   │
│   ├── auth/
│   │   └── authorize.ts         WHO CAN DO WHAT
│   │                            requireAdmin(), requireAgent(), requireCustomerAccess()
│   │
│   ├── validation/
│   │   └── index.ts             INPUT VALIDATION (Zod schemas for every API endpoint)
│   │
│   └── utils/
│       └── money.ts             toCents() and fromCents() — safe money math
│
├── auth.ts                      LOGIN CONFIG (NextAuth — session, JWT, password check)
│
├── __tests__/                   AUTOMATED UNIT TESTS
│   ├── loan-business-logic.test.ts
│   ├── financial-integrity.test.ts
│   ├── collections-service.test.ts  ← tests real createCollection
│   ├── expense-service.test.ts      ← tests real createExpense/approveExpense
│   ├── ledger-integrity.test.ts     ← tests ledger entry writing
│   ├── money-math.test.ts           ← tests toCents/fromCents
│   ├── reconciliation-service.test.ts
│   ├── loan-service.test.ts
│   ├── security.test.ts
│   └── api-validation.test.ts
│
├── tests/robot/                 END-TO-END BROWSER TESTS
│
├── scripts/
│   └── verify-ledger.ts         Run with: bun run verify:ledger
│                                Checks all ledger entries match actual payments
│
├── supabase/migrations/         DATABASE CHANGE HISTORY
│                                (run these when setting up a new database)
│
├── public/                      STATIC FILES (images, icons)
│
├── README.md                    Setup + full feature documentation
└── ARCHITECTURE.md              This file — system overview for beginners
```

---

## Key Concepts

### How a Loan Works
```
Agent submits loan request (amount, interest, tenure)
         ↓
Admin approves → Loan created with repayment schedule
         ↓
Agent collects daily installments → PENDING
         ↓
Admin confirms each collection → CONFIRMED
         ↓
Loan closes when fully paid
```

### How Money is Tracked (Ledger)
Every time money moves, two things happen:
1. The relevant record is updated (e.g. due.outstanding_amount decreases)
2. A ledger entry is written (CREDIT = money in, DEBIT = money out) — this can NEVER be deleted

### How Outstanding Balance is Calculated
```
Customer Outstanding =
  Opening Balance (starting debt)
  + Unpaid Dues (invoices)
  + Active Loan Outstanding
  - Confirmed Freeform Collections (cash already paid)
```

### Security
- Every API endpoint checks your role before doing anything
- Agents can only see their own data
- Admins scoped to a branch only see that branch's data
- GPS is required for attendance check-in (accuracy > 200m is rejected)
- Sessions expire after 8 hours or 2 minutes of idle time

---

## Tech Stack (What tools are used)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (React) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL |
| DB Access | Drizzle ORM |
| Auth | NextAuth v5 |
| Runtime | Bun |
| Tests | bun test (vitest-compatible) |
| E2E Tests | Robot Framework |
