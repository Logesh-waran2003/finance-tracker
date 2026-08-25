ALTER TABLE "collections" ADD CONSTRAINT "chk_collections_amount_positive" CHECK (amount > 0);--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "chk_collections_gps_lat" CHECK (gps_lat IS NULL OR (gps_lat >= -90 AND gps_lat <= 90));--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "chk_collections_gps_lng" CHECK (gps_lng IS NULL OR (gps_lng >= -180 AND gps_lng <= 180));--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "chk_collections_gps_accuracy" CHECK (gps_accuracy IS NULL OR gps_accuracy >= 0);--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "chk_dues_amount_positive" CHECK (amount > 0);--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "chk_dues_outstanding_non_negative" CHECK (outstanding_amount >= 0);--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "chk_dues_outstanding_lte_amount" CHECK (outstanding_amount <= amount);--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expenses_amount_positive" CHECK (amount > 0);--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "chk_reconciliations_cash_collected_non_negative" CHECK (cash_collected >= 0);--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "chk_reconciliations_cash_submitted_non_negative" CHECK (cash_submitted >= 0);