export type UserRole = 'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'WEEK_OFF'
export type CollectionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'
export type DueStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type ReconciliationStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  role: UserRole
  branch_id?: string
  employee_code?: string
  department?: string
  designation?: string
  joining_date?: string
  avatar_url?: string
  is_active: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  phone?: string
  email?: string
  is_active: boolean
}

export interface Customer {
  id: string
  customer_code: string
  full_name: string
  phone?: string
  email?: string
  address?: string
  area?: string
  city?: string
  assigned_agent_id?: string
  branch_id?: string
  opening_balance: number
  is_active: boolean
}

export interface Due {
  id: string
  customer_id: string
  invoice_number?: string
  reference?: string
  amount: number
  outstanding_amount: number
  due_date?: string
  status: DueStatus
  notes?: string
}

export interface Collection {
  id: string
  collection_number: string
  customer_id: string
  due_id?: string
  agent_id: string
  branch_id?: string
  amount: number
  payment_mode: PaymentMode
  payment_reference?: string
  receipt_url?: string
  notes?: string
  status: CollectionStatus
  collected_at: string
}

export interface Attendance {
  id: string
  employee_id: string
  date: string
  check_in_at?: string
  check_out_at?: string
  total_hours?: number
  status: AttendanceStatus
  notes?: string
}

export interface Expense {
  id: string
  category_id: string
  employee_id: string
  branch_id?: string
  amount: number
  payment_mode: PaymentMode
  description: string
  receipt_url?: string
  expense_date: string
  status: ExpenseStatus
}
