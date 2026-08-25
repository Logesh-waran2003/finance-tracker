-- Migration 0002: Add DB-level CHECK constraints for financial integrity
-- These constraints back up Zod validation — protect against direct DB writes,
-- future code paths, and bugs that bypass the API layer.

-- collections: amount > 0, GPS ranges
ALTER TABLE collections
  ADD CONSTRAINT chk_collections_amount_positive CHECK (amount > 0);

ALTER TABLE collections
  ADD CONSTRAINT chk_collections_gps_lat CHECK (gps_lat IS NULL OR (gps_lat >= -90 AND gps_lat <= 90));

ALTER TABLE collections
  ADD CONSTRAINT chk_collections_gps_lng CHECK (gps_lng IS NULL OR (gps_lng >= -180 AND gps_lng <= 180));

ALTER TABLE collections
  ADD CONSTRAINT chk_collections_gps_accuracy CHECK (gps_accuracy IS NULL OR gps_accuracy >= 0);

-- dues: amount > 0, outstanding >= 0 and <= amount
ALTER TABLE dues
  ADD CONSTRAINT chk_dues_amount_positive CHECK (amount > 0);

ALTER TABLE dues
  ADD CONSTRAINT chk_dues_outstanding_non_negative CHECK (outstanding_amount >= 0);

ALTER TABLE dues
  ADD CONSTRAINT chk_dues_outstanding_lte_amount CHECK (outstanding_amount <= amount);

-- expenses: amount > 0
ALTER TABLE expenses
  ADD CONSTRAINT chk_expenses_amount_positive CHECK (amount > 0);

-- reconciliations: cash values >= 0
ALTER TABLE reconciliations
  ADD CONSTRAINT chk_reconciliations_cash_collected_non_negative CHECK (cash_collected >= 0);

ALTER TABLE reconciliations
  ADD CONSTRAINT chk_reconciliations_cash_submitted_non_negative CHECK (cash_submitted >= 0);
