---

# Finance Tracker — Security & Architecture Audit Report

Generated from full codebase inspection before any hardening changes.

---

## 1. Entity Map

| Entity | Table | Key Relationships |
|--------|-------|-------------------|
| Users/Employees | `profiles` | branch_id → branches, self-managed auth (bcrypt, no Supabase auth) |
| Branches | `branches` | — |
| Customers | `customers` | assigned_agent_id → profiles, branch_id → branches, created_by → profiles |
| Dues | `dues` | customer_id → customers, created_by → profiles |
| Collections | `collections` | customer_id → customers, due_id → dues, agent_id → profiles, branch_id → branches, confirmed_by → profiles |
| Attendance | `attendance` | employee_id → profiles, branch_id → branches, corrected_by → profiles |
| Reconciliations | `reconciliations` | agent_id → profiles, branch_id → branches, verified_by → profiles |
| Expenses | `expenses` | category_id → expense_categories, employee_id → profiles, branch_id → branches, approved_by → profiles |
| Cashbook | `cashbook_entries` | branch_id → branches, created_by → profiles |
| Audit Logs | `audit_logs` | actor_id → profiles |
| Notifications | `notifications` | recipient_id → profiles |
| Agent Targets | `agent_targets` | agent_id → profiles, branch_id → branches |
| Settings | `settings` | — |

**Schema discrepancy**: Drizzle schema defines `audit_logs.before_data`/`after_data` as `text` (JSON strings). The Supabase SQL migration defines them as `jsonb`. Code writes `JSON.stringify(...)` strings — inconsistent with migration.

---

## 2. Money-Changing Operations

| Operation | Route | State Change |
|-----------|-------|--------------|
| Create collection | POST /api/collections | Inserts PENDING collection, triggers `recalculate_due_outstanding` |
| Confirm collection | PATCH /api/admin/collections/[id] (action=confirm) | PENDING → CONFIRMED, triggers due recalculation |
| Reject collection | PATCH /api/admin/collections/[id] (action=reject) | PENDING → REJECTED |
| Cancel collection (agent) | PATCH /api/collections/[id] | PENDING → CANCELLED |
| Cancel collection (admin) | PATCH /api/admin/collections/[id] (action=cancel) | PENDING → CANCELLED |
| Create due | POST /api/admin/dues | Inserts OPEN due |
| Update due | PATCH /api/admin/dues/[id] | Updates amount/status/outstanding |
| Cancel due | DELETE /api/admin/dues/[id] | soft: status → CANCELLED, outstanding → 0 |
| Submit reconciliation | POST /api/reconciliation | Agent submits cash_collected + cash_submitted |
| Verify reconciliation | PATCH /api/admin/reconciliation/[id] (action=verify) | PENDING/SUBMITTED → VERIFIED |
| Approve expense | PATCH /api/admin/expenses/[id] (action=approve) | PENDING → APPROVED |
| Reject expense | PATCH /api/admin/expenses/[id] (action=reject) | PENDING → REJECTED |
| Delete expense (agent) | DELETE /api/expenses/[id] | Hard DELETE from DB |

---

## 3. State Transitions

### Collection: PENDING → CONFIRMED | REJECTED | CANCELLED
- PENDING → CONFIRMED: admin only, via admin route
- PENDING → REJECTED: admin only, requires reason
- PENDING → CANCELLED: agent (own) or admin
- No reversal flow exists
- **Gap**: No check that collection amount ≤ due outstanding before confirming

### Due: OPEN → PARTIALLY_PAID | PAID | OVERDUE | CANCELLED
- Driven by DB trigger `recalculate_due_outstanding` on collection insert/update
- Admin can set arbitrary status via PATCH (no transition guard)
- **Gap**: Admin PATCH allows backward transitions (PAID → OPEN) without audit trail

### Reconciliation: PENDING → SUBMITTED → VERIFIED | REJECTED
- Agent creates as PENDING; no SUBMITTED transition in current code — agent creates PENDING, admin verifies directly
- **Gap**: Status stays PENDING after agent submission (schema has SUBMITTED but code never sets it)

### Expense: PENDING → APPROVED | REJECTED
- Agent creates PENDING, admin approves/rejects

### Attendance: ABSENT → PRESENT | LATE | HALF_DAY | LEAVE | WEEK_OFF
- Check-in sets PRESENT or LATE; checkout triggers DB trigger to recalculate
- Admin can correct any field freely

---

## 4. Authorization Assumptions

| Route | Assumed | Actual Check |
|-------|---------|--------------|
| GET /api/customers | Agent sees only assigned customers | ✅ filters by assigned_agent_id |
| GET /api/customers/[id] (agent route) | Agent can only see assigned | ✅ ownership check |
| GET /api/admin/customers/[id] | Any authenticated user | ✅ admin check |
| POST /api/collections | Agent must be assigned to customer | ✅ checks assigned_agent_id |
| PATCH /api/collections/[id] | Agent cancels own only | ✅ checks agent_id === session.id |
| GET /api/dues | Agent queries any customer_id | ❌ NO ownership check — IDOR |
| GET /api/admin/dues | Admin only | ❌ MISSING role check on GET — any authenticated user |
| POST /api/reconciliation | Agent submits own | ✅ uses session.id |
| GET /api/attendance/history | Agent sees only self | ✅ (admin can see others) |

---

## 5. IDOR / BOLA Vulnerabilities

### CRITICAL

**1. GET /api/dues — No customer ownership check**
- Route: `app/api/dues/route.ts`
- Any COLLECTION_AGENT can supply any `customer_id` and retrieve all dues for customers not assigned to them
- Fix: verify `customers.assigned_agent_id === session.user.id` before returning dues

**2. GET /api/admin/dues — Missing admin role check**
- Route: `app/api/admin/dues/route.ts` GET handler
- Only checks `session?.user?.id` — no role check. Any authenticated user (STAFF, COLLECTION_AGENT) can list all dues for any customer
- Fix: add `getAdmin()` guard to GET handler

**3. POST /api/reconciliation — Client-supplied cash_collected trusted**
- Route: `app/api/reconciliation/route.ts`
- Agent submits their own `cash_collected` value; server accepts it without verifying against actual confirmed CASH collections
- An agent can lie about how much cash they collected (over-report to cover a shortage, or under-report to pocket cash)
- Fix: server must compute `cash_collected = SUM(amount) FROM collections WHERE agent_id=? AND payment_mode='CASH' AND status='CONFIRMED' AND date=?`

**4. POST /api/reconciliation — No duplicate check**
- Agent can submit multiple reconciliations for the same date
- Fix: unique constraint on (agent_id, date) + check before insert

**5. POST /api/collections — Idempotency check is non-atomic**
- Route: `app/api/collections/route.ts`
- Check-then-insert for idempotency_key is two separate queries with no transaction or SELECT FOR UPDATE
- Race condition: two simultaneous requests with same key can both pass the check and both insert
- Fix: wrap in DB transaction, rely on UNIQUE constraint, catch unique violation

**6. POST /api/collections — No due status validation**
- No check that the referenced `due_id` has status OPEN or PARTIALLY_PAID before creating a collection
- Agent can collect against an already-PAID or CANCELLED due
- Fix: check due.status NOT IN ('PAID', 'CANCELLED') before insert

**7. POST /api/collections — No over-collection guard**
- No check that `amount <= due.outstanding_amount`
- Agent can collect more than what's owed
- Fix: server-side check amount <= outstanding before insert

**8. POST /api/collections — due_id ownership not verified**
- No check that `due_id` belongs to `customer_id`
- Agent can link a collection to a due from a different customer
- Fix: verify due.customer_id === customer_id

### MEDIUM

**9. Password change doesn't invalidate existing sessions**
- Route: `app/api/change-password/route.ts`
- JWT tokens remain valid after password change; old token can still authenticate
- Fix: add `password_changed_at` to profiles, embed in JWT, reject tokens issued before the change

**10. No rate limiting on auth routes**
- `/api/auth/*` has no rate limiting — brute force possible
- Fix: in-memory rate limiter (or Redis) keyed by IP

**11. GPS coordinates not validated server-side**
- Attendance check-in/out and collection GPS values accepted without range validation
- A client can submit lat=999, lng=999
- Fix: validate lat ∈ [-90,90], lng ∈ [-180,180], accuracy > 0

**12. Error details may leak internals**
- Some catch blocks rethrow (e.g. employees route) which Next.js may return as 500 with details
- Fix: wrap top-level handlers in try/catch, return generic 500

**13. Cashbook/ledger not written from financial operations**
- `cashbook_entries` table exists but nothing writes to it on collection confirm, expense approve, or reconciliation verify
- Financial record is incomplete
- Fix: ledger service that writes atomically in same transaction

**14. Hard delete of PENDING expenses**
- `DELETE /api/expenses/[id]` hard-deletes from DB — financial history gap
- Fix: soft delete (deleted_at timestamp) or status = 'WITHDRAWN'

**15. No environment variable validation**
- `DATABASE_URL` accessed with `!` assertion — crashes at runtime with cryptic error if unset
- Fix: validate required env vars at startup

**16. No security headers**
- `next.config.ts` is empty — no CSP, X-Frame-Options, X-Content-Type-Options, etc.
- Fix: add headers via next.config.ts

**17. No Zod validation on most routes**
- Request bodies parsed with raw `request.json()` and ad-hoc field checks
- Missing UUID format validation on IDs, numeric range checks on amounts
- Fix: Zod schemas for every sensitive route

**18. `collection_number` not in Drizzle schema as NOT NULL**
- Generated by DB trigger but schema allows null; could cause issues if trigger is absent
- Fix: ensure trigger applied before production use

**19. Reconciliation — no future date check**
- Agent can submit a reconciliation for a future date
- Fix: validate `date <= today`

---

## 6. Known Gaps After This Audit

- No middleware.ts protecting routes at Next.js layer (only route-level auth)
- Session token contains role/branch_id from login time — stale if admin changes user's role (won't take effect until re-login)
- No refresh token rotation or explicit logout invalidation
- Cashbook running_balance is never computed (nullable column, trigger not written)
- Agent Targets created but no UI or enforcement visible
- Reports routes (attendance, dues, reconciliation, expenses) not fully inspected — assumed similar pattern to collections report
