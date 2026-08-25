import { z } from 'zod'

// ── Primitives ──────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Invalid UUID')

export const positiveAmountSchema = z
  .number()
  .positive('amount must be > 0')

export const nonNegativeAmountSchema = z
  .number()
  .min(0, 'amount cannot be negative')

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')

export const gpsCoordSchema = z.object({
  gps_lat: z
    .number()
    .min(-90, 'latitude must be between -90 and 90')
    .max(90, 'latitude must be between -90 and 90')
    .optional()
    .nullable(),
  gps_lng: z
    .number()
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180')
    .optional()
    .nullable(),
  gps_accuracy: z
    .number()
    .min(0)
    .max(10000, 'gps_accuracy seems unrealistic')
    .optional()
    .nullable(),
})

// ── Collections ──────────────────────────────────────────────────────────────

export const createCollectionSchema = z
  .object({
    customer_id: uuidSchema,
    due_id: uuidSchema.optional().nullable(),
    amount: positiveAmountSchema,
    payment_mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
    payment_reference: z.string().max(255).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    idempotency_key: z.string().min(1).max(128).optional().nullable(),
  })
  .merge(gpsCoordSchema)

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>

export const adminCollectionActionSchema = z.object({
  action: z.enum(['confirm', 'reject', 'cancel']),
  reason: z.string().min(1).max(500).optional().nullable(),
})

// ── Dues ─────────────────────────────────────────────────────────────────────

export const createDueSchema = z.object({
  customer_id: uuidSchema,
  amount: positiveAmountSchema,
  invoice_number: z.string().max(100).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  due_date: dateStringSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const updateDueSchema = z.object({
  amount: positiveAmountSchema.optional(),
  invoice_number: z.string().max(100).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  due_date: dateStringSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z
    .enum(['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'])
    .optional(),
})

// ── Reconciliation ───────────────────────────────────────────────────────────

export const createReconciliationSchema = z.object({
  cash_submitted: positiveAmountSchema,
  date: dateStringSchema,
  notes: z.string().max(1000).optional().nullable(),
})

export const adminReconciliationActionSchema = z.object({
  action: z.enum(['verify', 'reject']),
  reason: z.string().min(1).max(500).optional().nullable(),
})

// ── Expenses ─────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  category_id: uuidSchema,
  amount: positiveAmountSchema,
  payment_mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).optional(),
  description: z.string().min(1).max(500),
  expense_date: dateStringSchema,
  receipt_url: z.string().url().max(500).optional().nullable(),
})

export const adminExpenseActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(500).optional().nullable(),
})

// ── Attendance ───────────────────────────────────────────────────────────────

export const checkinSchema = gpsCoordSchema

export const adminMarkAttendanceSchema = z.object({
  employee_id: uuidSchema,
  date: dateStringSchema,
  status: z.enum(['LEAVE', 'WEEK_OFF']),
  notes: z.string().max(500).optional().nullable(),
})

export const adminCorrectAttendanceSchema = z.object({
  status: z
    .enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'WEEK_OFF'])
    .optional(),
  check_in_at: z.string().datetime().optional().nullable(),
  check_out_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

// ── Auth / Profile ────────────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
  avatar_url: z.string().url().max(500).optional().nullable(),
})

// ── Employees ────────────────────────────────────────────────────────────────

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

// ── Customers ────────────────────────────────────────────────────────────────

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

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Parse and validate a request body against a Zod schema.
 * Returns { ok: true, data } on success or { ok: false, response } on failure.
 * The `ok` discriminant lets TypeScript narrow the type precisely.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    const { NextResponse } = await import('next/server')
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const { NextResponse } = await import('next/server')
    const issues: { path: (string | number)[]; message: string }[] =
      (result.error as any).issues ?? (result.error as any).errors ?? []
    const first = issues[0]
    return {
      ok: false,
      response: NextResponse.json(
        { error: first ? `${first.path.join('.')}: ${first.message}` : 'Validation error' },
        { status: 400 }
      ),
    }
  }

  return { ok: true, data: result.data }
}
