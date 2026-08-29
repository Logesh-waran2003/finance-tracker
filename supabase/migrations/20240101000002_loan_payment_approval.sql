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

-- Allow re-collection after rejection: exclude REJECTED from the active-payment uniqueness guard
DROP INDEX IF EXISTS uq_loan_payments_schedule_active;
CREATE UNIQUE INDEX uq_loan_payments_schedule_active
  ON loan_payments (loan_schedule_id)
  WHERE (NOT is_reversed AND status NOT IN ('REJECTED'));
