import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { branches, profiles, customers, dues, expenseCategories, settings, collections, expenses, reconciliations, attendance } from '@/lib/db/schema'

// WARNING: Change these credentials before production deployment
if (process.env.NODE_ENV === 'production') {
  throw new Error('Do not run seed script in production')
}

async function seed() {
  console.log('Seeding settings...')
  await db.insert(settings).values({
    company_name: 'Demo Company',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    financial_year_start: 4,
  }).onConflictDoNothing()

  console.log('Seeding branches...')
  const [headOffice] = await db.insert(branches).values([
    { name: 'Head Office', code: 'HO-001', address: '123 Main Street', city: 'Chennai', state: 'Tamil Nadu', phone: '+91-9876543210', email: 'admin@demo.com' },
    { name: 'South Branch', code: 'SO-001', address: '456 Anna Salai', city: 'Chennai', state: 'Tamil Nadu', phone: '+91-9876543211', email: 'south@demo.com' },
  ]).onConflictDoNothing().returning()

  const branchId = headOffice?.id

  console.log('Seeding expense categories...')
  await db.insert(expenseCategories).values([
    { name: 'Travel' }, { name: 'Food' }, { name: 'Office Supplies' },
    { name: 'Communication' }, { name: 'Utilities' }, { name: 'Miscellaneous' },
  ]).onConflictDoNothing()

  console.log('Seeding users...')
  const hash = async (pw: string) => bcrypt.hash(pw, 12)

  const usersData = [
    { email: 'admin@demo.com', full_name: 'Admin User', role: 'ADMIN' as const, employee_code: 'EMP-001', password_hash: await hash('Demo@1234') },
    { email: 'agent@demo.com', full_name: 'Collection Agent', role: 'COLLECTION_AGENT' as const, employee_code: 'EMP-002', password_hash: await hash('Demo@1234') },
    { email: 'staff@demo.com', full_name: 'Staff Member', role: 'STAFF' as const, employee_code: 'EMP-003', password_hash: await hash('Demo@1234') },
  ]

  const insertedUsers = await db.insert(profiles).values(
    usersData.map(u => ({
      ...u,
      branch_id: branchId ?? null,
      joining_date: new Date().toISOString().split('T')[0],
      is_active: true,
    }))
  ).onConflictDoNothing().returning()

  const agentProfile = insertedUsers.find(u => u.employee_code === 'EMP-002')
    ?? await db.select().from(profiles).where(require('drizzle-orm').eq(profiles.employee_code, 'EMP-002')).limit(1).then((r: any) => r[0])

  if (agentProfile) {
    console.log('Seeding customers...')
    const insertedCustomers = await db.insert(customers).values([
      { customer_code: 'CUST-001', full_name: 'Ravi Kumar', phone: '9876543001', area: 'T Nagar', address: '12 North St', city: 'Chennai', opening_balance: '5000', assigned_agent_id: agentProfile.id, branch_id: branchId ?? null },
      { customer_code: 'CUST-002', full_name: 'Priya Sharma', phone: '9876543002', area: 'Adyar', address: '34 South Ave', city: 'Chennai', opening_balance: '12000', assigned_agent_id: agentProfile.id, branch_id: branchId ?? null },
      { customer_code: 'CUST-003', full_name: 'Senthil Vel', phone: '9876543003', area: 'Velachery', address: '56 Main Rd', city: 'Chennai', opening_balance: '8500', assigned_agent_id: agentProfile.id, branch_id: branchId ?? null },
    ]).onConflictDoNothing().returning()

    console.log('Seeding dues...')
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    for (const c of insertedCustomers) {
      await db.insert(dues).values({
        customer_id: c.id,
        invoice_number: `INV-${Math.floor(Math.random() * 9000 + 1000)}`,
        amount: c.opening_balance,
        outstanding_amount: c.opening_balance,
        due_date: dueDate,
        status: 'OPEN',
      })
    }
    console.log('Seeded 3 customers + 3 dues')

    // ------------------------------------------------------------------
    // Workload so the admin queues are actually observable.
    //
    // Without this the DB has zero collections, expenses, reconciliations and
    // attendance, so every admin approve/reject screen renders an empty state
    // and neither a developer nor a reviewer can see — let alone test — the
    // flows that move money.
    //
    // branch_id MATTERS: every admin PATCH route filters by the admin's branch,
    // so a row seeded with branch_id NULL returns 404 when actioned and the
    // screen looks broken for no visible reason.
    // ------------------------------------------------------------------
    console.log('Seeding workload (pending queues)...')
    const istDay = (offset = 0) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
        .format(new Date(Date.now() + offset * 86_400_000))

    const [c1, c2, c3] = insertedCustomers

    await db.insert(collections).values([
      { customer_id: c1.id, agent_id: agentProfile.id, branch_id: branchId ?? null, amount: '1500.00', payment_mode: 'CASH', status: 'PENDING', idempotency_key: crypto.randomUUID(), collected_at: new Date() },
      { customer_id: c2.id, agent_id: agentProfile.id, branch_id: branchId ?? null, amount: '2500.00', payment_mode: 'UPI', status: 'PENDING', idempotency_key: crypto.randomUUID(), collected_at: new Date() },
      { customer_id: c3.id, agent_id: agentProfile.id, branch_id: branchId ?? null, amount: '800.00', payment_mode: 'CASH', status: 'CONFIRMED', idempotency_key: crypto.randomUUID(), collected_at: new Date() },
    ]).onConflictDoNothing()

    const [travelCat] = await db.select().from(expenseCategories).limit(1)
    if (travelCat) {
      await db.insert(expenses).values([
        { category_id: travelCat.id, employee_id: agentProfile.id, branch_id: branchId ?? null, amount: '250.00', payment_mode: 'CASH', description: 'Bus fare to Adyar', expense_date: istDay(), status: 'PENDING', idempotency_key: crypto.randomUUID() },
        { category_id: travelCat.id, employee_id: agentProfile.id, branch_id: branchId ?? null, amount: '450.00', payment_mode: 'CASH', description: 'Auto to Velachery', expense_date: istDay(-1), status: 'APPROVED', idempotency_key: crypto.randomUUID() },
      ]).onConflictDoNothing()
    }

    // One of each difference case, so the shortfall/matched/excess colouring is
    // visible without hand-crafting rows. difference is GENERATED — never set it.
    await db.insert(reconciliations).values([
      { agent_id: agentProfile.id, branch_id: branchId ?? null, date: istDay(-1), cash_collected: '9000.00', cash_submitted: '7000.00', status: 'PENDING' },
      { agent_id: agentProfile.id, branch_id: branchId ?? null, date: istDay(-2), cash_collected: '5000.00', cash_submitted: '5000.00', status: 'VERIFIED' },
    ]).onConflictDoNothing()

    await db.insert(attendance).values([
      { employee_id: agentProfile.id, branch_id: branchId ?? null, date: istDay(-1), status: 'PRESENT', check_in_at: new Date(Date.now() - 86_400_000) },
      { employee_id: agentProfile.id, branch_id: branchId ?? null, date: istDay(-2), status: 'LATE', check_in_at: new Date(Date.now() - 2 * 86_400_000) },
    ]).onConflictDoNothing()

    console.log('Seeded workload: 3 collections (2 pending), 2 expenses, 2 reconciliations, 2 attendance')
  }

  console.log('\nSeed complete!')
  console.log('Demo credentials:')
  console.log('  Admin:  admin@demo.com / Demo@1234')
  console.log('  Agent:  agent@demo.com / Demo@1234')
  console.log('  Staff:  staff@demo.com / Demo@1234')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
