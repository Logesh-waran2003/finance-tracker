import { pgTable, pgEnum, uuid, text, boolean, timestamp, date, numeric, integer, unique, index, jsonb } from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'

// ============================================================
// ENUMS
// ============================================================
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'COLLECTION_AGENT', 'STAFF'])
export const attendanceStatusEnum = pgEnum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'WEEK_OFF'])
export const collectionStatusEnum = pgEnum('collection_status', ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'])
export const dueStatusEnum = pgEnum('due_status', ['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'])
export const reconciliationStatusEnum = pgEnum('reconciliation_status', ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'])
export const expenseStatusEnum = pgEnum('expense_status', ['PENDING', 'APPROVED', 'REJECTED'])
export const paymentModeEnum = pgEnum('payment_mode', ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'])
export const notificationTypeEnum = pgEnum('notification_type', ['PENDING_CUSTOMER', 'MISSED_ATTENDANCE', 'CASH_HANDOVER', 'RECONCILIATION_DIFF', 'TARGET_ALERT', 'GENERAL'])
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', ['CREDIT', 'DEBIT', 'RECONCILIATION', 'REVERSAL'])
export const ledgerEntityTypeEnum = pgEnum('ledger_entity_type', ['collection', 'expense', 'reconciliation'])

// ============================================================
// SETTINGS
// ============================================================
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_name: text('company_name').notNull().default('My Company'),
  currency: text('currency').notNull().default('INR'),
  currency_symbol: text('currency_symbol').notNull().default('₹'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  financial_year_start: integer('financial_year_start').notNull().default(4),
  logo_url: text('logo_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ============================================================
// BRANCHES
// ============================================================
export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').unique().notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  phone: text('phone'),
  email: text('email'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ============================================================
// PROFILES (users — password_hash stored here, no auth.users)
// ============================================================
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  full_name: text('full_name').notNull().default(''),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('STAFF'),
  branch_id: uuid('branch_id').references(() => branches.id),
  employee_code: text('employee_code').unique(),
  department: text('department'),
  designation: text('designation'),
  joining_date: date('joining_date'),
  avatar_url: text('avatar_url'),
  is_active: boolean('is_active').default(true),
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
  // Incremented on password change to invalidate old JWT tokens
  password_version: integer('password_version').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ============================================================
// CUSTOMERS
// ============================================================
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  customer_code: text('customer_code').unique().notNull(),
  full_name: text('full_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  area: text('area'),
  city: text('city'),
  state: text('state'),
  pincode: text('pincode'),
  gps_lat: numeric('gps_lat', { precision: 10, scale: 7 }),
  gps_lng: numeric('gps_lng', { precision: 10, scale: 7 }),
  assigned_agent_id: uuid('assigned_agent_id').references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  opening_balance: numeric('opening_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  is_active: boolean('is_active').default(true),
  notes: text('notes'),
  created_by: uuid('created_by').references(() => profiles.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_customers_agent').on(t.assigned_agent_id),
  index('idx_customers_branch').on(t.branch_id),
])

// ============================================================
// DUES
// ============================================================
export const dues = pgTable('dues', {
  id: uuid('id').primaryKey().defaultRandom(),
  customer_id: uuid('customer_id').notNull().references(() => customers.id),
  invoice_number: text('invoice_number'),
  reference: text('reference'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  outstanding_amount: numeric('outstanding_amount', { precision: 12, scale: 2 }).notNull(),
  due_date: date('due_date'),
  status: dueStatusEnum('status').notNull().default('OPEN'),
  notes: text('notes'),
  created_by: uuid('created_by').references(() => profiles.id),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_dues_customer').on(t.customer_id),
  index('idx_dues_status').on(t.status),
])

// ============================================================
// COLLECTIONS
// ============================================================
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  collection_number: text('collection_number').unique(),
  customer_id: uuid('customer_id').notNull().references(() => customers.id),
  due_id: uuid('due_id').references(() => dues.id),
  agent_id: uuid('agent_id').notNull().references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  payment_mode: paymentModeEnum('payment_mode').notNull().default('CASH'),
  payment_reference: text('payment_reference'),
  receipt_url: text('receipt_url'),
  notes: text('notes'),
  gps_lat: numeric('gps_lat', { precision: 10, scale: 7 }),
  gps_lng: numeric('gps_lng', { precision: 10, scale: 7 }),
  gps_accuracy: numeric('gps_accuracy', { precision: 8, scale: 2 }),
  status: collectionStatusEnum('status').notNull().default('PENDING'),
  confirmed_by: uuid('confirmed_by').references(() => profiles.id),
  confirmed_at: timestamp('confirmed_at', { withTimezone: true }),
  rejected_reason: text('rejected_reason'),
  collected_at: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
  idempotency_key: text('idempotency_key').unique(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_collections_agent').on(t.agent_id),
  index('idx_collections_customer').on(t.customer_id),
  index('idx_collections_status').on(t.status),
  index('idx_collections_date').on(t.collected_at),
])

// ============================================================
// ATTENDANCE
// ============================================================
export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  employee_id: uuid('employee_id').notNull().references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  date: date('date').notNull(),
  check_in_at: timestamp('check_in_at', { withTimezone: true }),
  check_out_at: timestamp('check_out_at', { withTimezone: true }),
  check_in_gps_lat: numeric('check_in_gps_lat', { precision: 10, scale: 7 }),
  check_in_gps_lng: numeric('check_in_gps_lng', { precision: 10, scale: 7 }),
  check_in_gps_accuracy: numeric('check_in_gps_accuracy', { precision: 8, scale: 2 }),
  check_out_gps_lat: numeric('check_out_gps_lat', { precision: 10, scale: 7 }),
  check_out_gps_lng: numeric('check_out_gps_lng', { precision: 10, scale: 7 }),
  check_out_gps_accuracy: numeric('check_out_gps_accuracy', { precision: 8, scale: 2 }),
  total_hours: numeric('total_hours', { precision: 4, scale: 2 }),
  status: attendanceStatusEnum('status').notNull().default('ABSENT'),
  notes: text('notes'),
  corrected_by: uuid('corrected_by').references(() => profiles.id),
  corrected_at: timestamp('corrected_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.employee_id, t.date),
  index('idx_attendance_employee_date').on(t.employee_id, t.date),
])

// ============================================================
// RECONCILIATIONS
// ============================================================
export const reconciliations = pgTable('reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  date: date('date').notNull(),
  cash_collected: numeric('cash_collected', { precision: 12, scale: 2 }).notNull().default('0'),
  cash_submitted: numeric('cash_submitted', { precision: 12, scale: 2 }).notNull().default('0'),
  difference: numeric('difference', { precision: 12, scale: 2 }).generatedAlwaysAs(
    sql`cash_collected - cash_submitted`
  ),
  status: reconciliationStatusEnum('status').notNull().default('PENDING'),
  notes: text('notes'),
  verified_by: uuid('verified_by').references(() => profiles.id),
  verified_at: timestamp('verified_at', { withTimezone: true }),
  rejection_reason: text('rejection_reason'),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  // Enforce one reconciliation per agent per date at the DB level
  unique('uq_reconciliations_agent_date').on(t.agent_id, t.date),
  index('idx_reconciliations_agent_date').on(t.agent_id, t.date),
])

// ============================================================
// EXPENSE CATEGORIES
// ============================================================
export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  description: text('description'),
  is_active: boolean('is_active').default(true),
})

// ============================================================
// EXPENSES
// ============================================================
export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  category_id: uuid('category_id').notNull().references(() => expenseCategories.id),
  employee_id: uuid('employee_id').notNull().references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  payment_mode: paymentModeEnum('payment_mode').notNull().default('CASH'),
  description: text('description').notNull(),
  receipt_url: text('receipt_url'),
  expense_date: date('expense_date').notNull(),
  status: expenseStatusEnum('status').notNull().default('PENDING'),
  approved_by: uuid('approved_by').references(() => profiles.id),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  rejection_reason: text('rejection_reason'),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ============================================================
// CASHBOOK ENTRIES (legacy — superseded by ledger_entries)
// ============================================================
export const cashbookEntries = pgTable('cashbook_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  branch_id: uuid('branch_id').references(() => branches.id),
  date: date('date').notNull(),
  entry_type: text('entry_type').notNull(),
  payment_mode: paymentModeEnum('payment_mode'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  reference_id: uuid('reference_id'),
  description: text('description'),
  running_balance: numeric('running_balance', { precision: 12, scale: 2 }),
  created_by: uuid('created_by').references(() => profiles.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ============================================================
// LEDGER ENTRIES (canonical financial record — append-only)
// ============================================================
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  entity_type: ledgerEntityTypeEnum('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  entry_type: ledgerEntryTypeEnum('entry_type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  actor_id: uuid('actor_id').notNull().references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_ledger_entity').on(t.entity_type, t.entity_id),
  index('idx_ledger_actor').on(t.actor_id),
  index('idx_ledger_created').on(t.created_at),
])

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipient_id: uuid('recipient_id').notNull().references(() => profiles.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  is_read: boolean('is_read').default(false),
  reference_id: uuid('reference_id'),
  reference_type: text('reference_type'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_notifications_recipient').on(t.recipient_id, t.is_read),
])

// ============================================================
// AUDIT LOGS (append-only)
// ============================================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actor_id: uuid('actor_id').references(() => profiles.id),
  actor_name: text('actor_name'),
  actor_email: text('actor_email'),
  action: text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id'),
  before_data: jsonb('before_data'),
  after_data: jsonb('after_data'),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  branch_id: uuid('branch_id').references(() => branches.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_audit_logs_entity').on(t.entity_type, t.entity_id),
  index('idx_audit_logs_actor').on(t.actor_id),
])

// ============================================================
// AGENT TARGETS
// ============================================================
export const agentTargets = pgTable('agent_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => profiles.id),
  branch_id: uuid('branch_id').references(() => branches.id),
  date: date('date').notNull(),
  target_amount: numeric('target_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  target_customers: integer('target_customers').notNull().default(0),
  created_by: uuid('created_by').references(() => profiles.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.agent_id, t.date),
])

// ============================================================
// RELATIONS
// ============================================================
export const profilesRelations = relations(profiles, ({ one }) => ({
  branch: one(branches, {
    fields: [profiles.branch_id],
    references: [branches.id],
  }),
}))

export const branchesRelations = relations(branches, ({ many }) => ({
  profiles: many(profiles),
}))
