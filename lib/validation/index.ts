/**
 * Shared Zod validation schemas and parseBody helper.
 * All API routes import from here.
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Primitives ────────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Must be a valid UUID')

export const positiveAmountSchema = z.number().positive('amount must be greater than 0')

export const nonNegativeAmountSchema = z.number().min(0, 'amount cannot be negative')

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')

export const paymentModeSchema = z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'])

export const collectionStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'])

export const dueStatusSchema = z.enum(['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'])

export const reconciliationStatusSchema = z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'])

export const expenseStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED'])

// ── Collections ───────────────────────────────────────────────────────────────

export const createCollectionSchema = z.object({
  customer_id: uuidSchema,
  due_id: uuidSchema.optional().nullable(),
  amount: positiveAmountSchema,
  payment_mode: paymentModeSchema,
  payment_reference: z.string().max(255).trim().optional(),
  notes: z.string().max(1000).trim().optional(),
  gps_lat: z.number().min(-90).max(90).optional(),
  gps_lng: z.number().min(-180).max(180).optional(),
  gps_accuracy: z.number().min(0).max(50000).optional(),
  idempotency_key: z.string().min(1).max(255).optional(),
})

export const adminCollectionActionSchema = z.object({
  action: z.enum(['confirm', 'reject', 'cancel']),
  reason: z.string().min(1).max(500).trim().optional(),
}).refine(
  (d) => d.action !== 'reject' || (d.reason && d.reason.length > 0),
  { message: 'reason is required for rejection', path: ['reason'] }
)

// ── Dues ──────────────────────────────────────────────────────────────────────

export const createDueSchema = z.object({
  customer_id: uuidSchema,
  amount: positiveAmountSchema,
  invoice_number: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
  due_date: dateStringSchema.optional(),
  notes: z.string().max(1000).optional(),
  penalty_rate: z.number().min(0).max(100).optional().default(0),
})

export const updateDueSchema = z.object({
  amount: positiveAmountSchema.optional(),
  invoice_number: z.string().max(100).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  due_date: dateStringSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  penalty_rate: z.number().min(0).max(100).optional(),
  status: z
    .enum(['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'])
    .optional(),
})

// ── Reconciliation ────────────────────────────────────────────────────────────
// cash_collected is NOT in this schema — the server calculates it from confirmed collections

export const createReconciliationSchema = z.object({
  date: dateStringSchema,
  cash_submitted: positiveAmountSchema,
  notes: z.string().max(1000).trim().optional(),
})

export const adminReconciliationActionSchema = z.object({
  action: z.enum(['verify', 'reject']),
  reason: z.string().min(1).max(500).trim().optional(),
}).refine(
  (d) => d.action !== 'reject' || (d.reason && d.reason.length > 0),
  { message: 'reason is required for rejection', path: ['reason'] }
)

// ── Expenses ──────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  category_id: uuidSchema,
  amount: positiveAmountSchema,
  payment_mode: paymentModeSchema.optional(),
  description: z.string().max(500).trim().optional().default(''),
  expense_date: dateStringSchema,
})

export const adminExpenseActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(500).trim().optional(),
}).refine(
  (d) => d.action !== 'reject' || (d.reason && d.reason.length > 0),
  { message: 'reason is required for rejection', path: ['reason'] }
)

// ── Attendance ────────────────────────────────────────────────────────────────

export const attendanceGpsSchema = z.object({
  gps_lat: z.number().min(-90).max(90).optional(),
  gps_lng: z.number().min(-180).max(180).optional(),
  gps_accuracy: z.number().min(0).max(50000).optional(),
})

export const adminMarkAttendanceSchema = z.object({
  employee_id: uuidSchema,
  date: dateStringSchema,
  status: z.enum(['LEAVE', 'WEEK_OFF']),
  notes: z.string().max(500).optional(),
})

export const adminCorrectAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'WEEK_OFF']).optional(),
  check_in_at: z.string().datetime().optional().nullable(),
  check_out_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(500).optional(),
})

// ── Auth / Profile ────────────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(255).trim().optional(),
  phone: z.string().max(20).trim().optional(),
  avatar_url: z.string().url().max(2000).optional().or(z.literal('')),
})

// ── Employees ─────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'COLLECTION_AGENT', 'STAFF']).optional(),
  employee_code: z.string().max(50).optional().nullable(),
  branch_id: uuidSchema.optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
  joining_date: dateStringSchema.optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
})

export const updateEmployeeSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional(),
  password: z.string().min(8).max(128).optional().nullable(),
  role: z.enum(['ADMIN', 'COLLECTION_AGENT', 'STAFF']).optional(),
  employee_code: z.string().max(50).optional().nullable(),
  branch_id: uuidSchema.optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
  joining_date: dateStringSchema.optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
})

// ── Branches ─────────────────────────────────────────────────────────────────

export const createBranchSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
})

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(20).optional(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  is_active: z.boolean().optional(),
})

// ── Settings ──────────────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  currency: z.string().min(1).max(10).optional(),
  currency_symbol: z.string().min(1).max(5).optional(),
  timezone: z.string().min(1).max(100).optional(),
  financial_year_start: z.number().int().min(1).max(12).optional(),
})

// ── Customers ─────────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  full_name: z.string().min(1).max(200),
  customer_code: z.string().max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  gps_lat: z.number().min(-90).max(90).optional().nullable(),
  gps_lng: z.number().min(-180).max(180).optional().nullable(),
  assigned_agent_id: uuidSchema.optional().nullable(),
  branch_id: uuidSchema.optional().nullable(),
  opening_balance: nonNegativeAmountSchema.optional(),
  notes: z.string().max(1000).optional().nullable(),
})

export const updateCustomerSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  customer_code: z.string().max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  gps_lat: z.number().min(-90).max(90).optional().nullable(),
  gps_lng: z.number().min(-180).max(180).optional().nullable(),
  assigned_agent_id: uuidSchema.optional().nullable(),
  branch_id: uuidSchema.optional().nullable(),
  opening_balance: nonNegativeAmountSchema.optional(),
  balance_deduction: positiveAmountSchema.optional(),
  _balance_reason: z.string().min(1).max(500).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
}).refine(
  d => (d.opening_balance === undefined && d.balance_deduction === undefined) || (d._balance_reason && d._balance_reason.length > 0),
  { message: 'Reason is required when adjusting balance', path: ['_balance_reason'] }
)

// ── Loans ─────────────────────────────────────────────────────────────────────

export const createLoanSchema = z.object({
  customer_id: uuidSchema,
  loan_amount: positiveAmountSchema,
  interest_percentage: z.number().min(0).max(100),
  daily_installment: positiveAmountSchema,
  penalty_amount: nonNegativeAmountSchema,
  disbursement_date: dateStringSchema,
  assigned_agent_id: uuidSchema,
  notes: z.string().max(1000).optional(),
})

export const collectInstallmentSchema = z.object({
  payment_mode: paymentModeSchema,
  payment_reference: z.string().max(255).optional(),
  transaction_reference: z.string().max(255).optional(),
})

export const reverseLoanPaymentSchema = z.object({
  loan_payment_id: uuidSchema,
  reason: z.string().min(1).max(500),
})

export const waivePenaltySchema = z.object({
  penalty_id: uuidSchema,
  waived_amount: positiveAmountSchema,
  reason: z.string().min(1).max(500),
})

export const patchLoanSchema = z.object({
  assigned_agent_id: uuidSchema.optional(),
  status: z.enum(['CANCELLED']).optional(),
  notes: z.string().max(1000).optional().nullable(),
})

// ── Reports ───────────────────────────────────────────────────────────────────

/** Max 1-year window enforced on all report exports. */
export const reportDateRangeSchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .refine(
    (d) => {
      if (!d.from || !d.to) return true
      const ms = new Date(d.to).getTime() - new Date(d.from).getTime()
      return ms >= 0 && ms <= 365 * 24 * 60 * 60 * 1000
    },
    { message: 'Date range cannot exceed 1 year', path: ['to'] }
  )

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Parses and validates a request body against a Zod schema.
 *
 * Returns `{ ok: true, data }` on success or `{ ok: false, response }` on failure.
 * Pattern: `if (!parsed.ok) return parsed.response`
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    // Zod v4 uses .issues; .errors is Zod v3 compat alias — handle both
    const issues: Array<{ path: unknown[]; message: string }> =
      (result.error as any).issues ?? (result.error as any).errors ?? []
    const message = issues.length > 0
      ? `${issues[0].path?.join('.') ?? ''}: ${issues[0].message}`.replace(/^: /, '')
      : 'Validation error'
    return { ok: false, response: NextResponse.json({ error: message }, { status: 400 }) }
  }

  return { ok: true, data: result.data }
}
