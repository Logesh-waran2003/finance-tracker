-- Loan payment approval flow
-- Payments now start as PENDING and require admin confirm/reject

ALTER TABLE loan_payments
  ADD COLUMN IF NOT EXISTS confirmed_by    uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS confirmed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;

-- Change default status to PENDING for new payments
ALTER TABLE loan_payments ALTER COLUMN status SET DEFAULT 'PENDING';

-- Existing CONFIRMED payments stay as-is (no data migration needed)

CREATE INDEX IF NOT EXISTS idx_loan_payments_status ON loan_payments(status);
