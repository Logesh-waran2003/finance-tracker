import { db } from '@/lib/db'
import { createLoan } from '@/lib/modules/loans/service'
import { collectInstallment } from '@/lib/modules/loans/payment-service'
import { loanRequests } from '@/lib/db/schema'

const ADMIN = 'def617fc-b807-414e-84eb-315c40c9f978'
const AGENT = 'a9fcf0fb-c92b-40fc-a27a-c594d91dbda9'
const BRANCH = '29ed0551-fa77-447b-af5c-c99a37b87796'
const CUSTOMERS = [
  '74a88e50-604d-4bcb-a0e7-85854d1d6cde',
  'd2eae694-4859-4fcf-8e41-bae353162d3b',
  'c6c534f0-b091-4f50-b67a-2ee715102c3f',
]

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const start = new Date(today + 'T00:00:00Z')
start.setUTCDate(start.getUTCDate() - 5)
const disb = start.toISOString().slice(0, 10)

const made: string[] = []
for (const [i, customerId] of CUSTOMERS.entries()) {
  const loan = await createLoan(db, {
    actorId: ADMIN,
    actorName: 'Admin User',
    actorEmail: 'admin@demo.com',
    branchId: BRANCH,
    customerId,
    loanAmount: 10000 * (i + 1),
    interestPercentage: 10,
    dailyInstallment: 250 * (i + 1),
    penaltyAmount: 50,
    disbursementDate: disb,
    repaymentStartDate: disb,
    assignedAgentId: AGENT,
    notes: i === 0 ? 'Shop front loan' : undefined,
  })
  made.push(loan.id)
  console.log('loan', loan.loan_number, loan.id)
}

// One collected payment awaiting approval
const pay = await collectInstallment(db, {
  loanId: made[0]!,
  agentId: AGENT,
  actorName: 'Collection Agent',
  actorEmail: 'agent@demo.com',
  branchId: BRANCH,
  paymentMode: 'CASH',
})
console.log('payment pending approval', pay.payment_number)

await db.insert(loanRequests).values([
  {
    request_number: 'LR-DEV-001',
    customer_id: CUSTOMERS[1]!,
    loan_amount: '15000.00',
    interest_percentage: '10.00',
    tenure: 60,
    daily_installment: '250.00',
    penalty_amount: '50.00',
    disbursement_date: today,
    notes: 'Needs money for stock',
    status: 'PENDING',
    requested_by: AGENT,
    branch_id: BRANCH,
  },
  {
    request_number: 'LR-DEV-002',
    new_customer_name: 'Muthu Vegetables',
    new_customer_phone: '9876500011',
    new_customer_area: 'Gandhi Market',
    loan_amount: '8000.00',
    interest_percentage: '12.00',
    tenure: 40,
    daily_installment: '200.00',
    penalty_amount: '0.00',
    disbursement_date: today,
    status: 'PENDING',
    requested_by: AGENT,
    branch_id: BRANCH,
  },
  {
    request_number: 'LR-DEV-003',
    customer_id: CUSTOMERS[2]!,
    loan_amount: '20000.00',
    interest_percentage: '10.00',
    tenure: 80,
    daily_installment: '250.00',
    penalty_amount: '50.00',
    disbursement_date: today,
    status: 'REJECTED',
    rejection_reason: 'Existing loan still outstanding',
    requested_by: AGENT,
    branch_id: BRANCH,
  },
])
console.log('requests inserted')
process.exit(0)
