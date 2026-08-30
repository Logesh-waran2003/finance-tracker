ALTER TABLE expenses ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
