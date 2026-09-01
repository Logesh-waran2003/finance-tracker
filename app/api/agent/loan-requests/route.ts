import { db } from '@/lib/db'
import { loanRequests, profiles, notifications } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, and, desc, sql, or, isNull } from 'drizzle-orm'
import { requireAgent, isResponse } from '@/lib/auth/authorize'
import { ServiceError } from '@/lib/modules/errors'

export async function GET() {
  const userOrRes = await requireAgent()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  const rows = await db.execute(sql`
    SELECT
      lr.*,
      c.full_name      AS customer_name,
      c.customer_code  AS customer_code
    FROM loan_requests lr
    LEFT JOIN customers c ON c.id = lr.customer_id
    WHERE lr.requested_by = ${actor.id}
    ORDER BY lr.created_at DESC
    LIMIT 100
  `)

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const userOrRes = await requireAgent()
  if (isResponse(userOrRes)) return userOrRes
  const actor = userOrRes

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    customer_id,
    new_customer_name,
    new_customer_phone,
    new_customer_area,
    loan_amount,
    interest_percentage = 0,
    tenure,
    penalty_amount = 0,
    disbursement_date,
    notes,
  } = body

  // Validate: must have either customer_id OR new_customer_name
  if (!customer_id && !new_customer_name) {
    return NextResponse.json(
      { error: 'Must provide either customer_id or new_customer_name' },
      { status: 400 },
    )
  }
  if (!loan_amount || loan_amount <= 0) {
    return NextResponse.json({ error: 'loan_amount must be greater than 0' }, { status: 400 })
  }
  if (!tenure || parseInt(tenure) <= 0) {
    return NextResponse.json({ error: 'tenure must be greater than 0' }, { status: 400 })
  }
  if (!disbursement_date) {
    return NextResponse.json({ error: 'disbursement_date is required' }, { status: 400 })
  }

  const daily_installment = parseFloat(loan_amount) / parseInt(tenure)

  try {
    // Generate request_number
    const [last] = await db
      .select({ request_number: loanRequests.request_number })
      .from(loanRequests)
      .orderBy(desc(loanRequests.request_number))
      .limit(1)

    const next = last?.request_number
      ? parseInt(last.request_number.split('-')[1], 10) + 1
      : 1001
    const request_number = `LR-${String(next).padStart(6, '0')}`

    const [inserted] = await db
      .insert(loanRequests)
      .values({
        request_number,
        customer_id: customer_id ?? null,
        new_customer_name: new_customer_name ?? null,
        new_customer_phone: new_customer_phone ?? null,
        new_customer_area: new_customer_area ?? null,
        loan_amount: String(loan_amount),
        interest_percentage: String(interest_percentage),
        tenure: parseInt(tenure),
        daily_installment: daily_installment.toFixed(2),
        penalty_amount: String(penalty_amount),
        disbursement_date,
        notes: notes ?? null,
        status: 'PENDING',
        requested_by: actor.id,
        branch_id: actor.branch_id ?? null,
      })
      .returning()

    // Notify all admins
    const adminConditions = and(eq(profiles.role, 'ADMIN'), eq(profiles.is_active, true))

    db.select({ id: profiles.id })
      .from(profiles)
      .where(adminConditions)
      .then(admins => {
        if (admins.length === 0) return
        return db.insert(notifications).values(
          admins.map(a => ({
            recipient_id: a.id,
            type: 'GENERAL' as const,
            title: 'New Loan Request',
            body: `${actor.name} requested a loan of ₹${loan_amount.toLocaleString('en-IN')} for ${customer_id ? 'existing customer' : new_customer_name}`,
            reference_id: inserted.id,
            reference_type: 'loan_request',
          }))
        )
      })
      .catch(() => {})

    return NextResponse.json(inserted, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
