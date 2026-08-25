-- Migration: 0001_hardening
-- Adds ledger_entries, soft-delete columns, unique constraint on reconciliations,
-- password_version for session invalidation, and auditLogs schema fixes.

-- ============================================================
-- ENUMS (add new ones)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM ('CREDIT', 'DEBIT', 'RECONCILIATION', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ledger_entity_type AS ENUM ('collection', 'expense', 'reconciliation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- profiles: add password_version for JWT invalidation
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_version INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- Soft-delete columns on financial tables
-- ============================================================
ALTER TABLE dues         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE collections  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expenses     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reconciliations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- reconciliations: enforce one per agent per date
-- ============================================================
ALTER TABLE reconciliations
  DROP CONSTRAINT IF EXISTS uq_reconciliations_agent_date;
ALTER TABLE reconciliations
  ADD CONSTRAINT uq_reconciliations_agent_date UNIQUE (agent_id, date);

-- ============================================================
-- audit_logs: fix data types, add columns
-- ============================================================
-- Change before_data/after_data from text to jsonb
ALTER TABLE audit_logs
  ALTER COLUMN before_data TYPE JSONB USING before_data::jsonb,
  ALTER COLUMN after_data  TYPE JSONB USING after_data::jsonb;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_email TEXT,
  ADD COLUMN IF NOT EXISTS branch_id   UUID REFERENCES branches(id),
  ALTER COLUMN entity_id TYPE TEXT;

-- ============================================================
-- LEDGER ENTRIES (canonical financial record)
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type ledger_entity_type NOT NULL,
  entity_id   UUID          NOT NULL,
  entry_type  ledger_entry_type  NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  actor_id    UUID          NOT NULL REFERENCES profiles(id),
  branch_id   UUID          REFERENCES branches(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entity  ON ledger_entries(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ledger_actor   ON ledger_entries(actor_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at);
