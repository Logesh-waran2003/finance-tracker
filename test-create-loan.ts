import { db } from '@/lib/db'
import { createLoan } from '@/lib/modules/loans/service'

try {
  const loan = await createLoan(db, {
    actorId: '00dd3eac-f494-48cc-ad0c-3f3071f87984',
    actorName: 'Admin User',
    actorEmail: 'admin@demo.com',
    branchId: '0098f17a-de4e-4d59-9ce0-ca2bb24f8ec9',
    customerId: 'dca2e7c0-7035-4ee5-a78e-d44b4e53bebd',
    loanAmount: 10000,
    interestPercentage: 12,
    dailyInstallment: 100,
    penaltyAmount: 0,
    disbursementDate: '2026-08-28',
    assignedAgentId: null,
    notes: undefined,
  })
  console.log('SUCCESS:', loan.loan_number, loan.id)
} catch (e: any) {
  console.error('ERROR:', e.message)
  if (e.cause) console.error('CAUSE:', e.cause)
}
