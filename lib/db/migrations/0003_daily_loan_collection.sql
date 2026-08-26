-- Migration: 0003_daily_loan_collection
-- Adds loan management schema: loans, loan_schedules, loan_penalties,
-- loan_payments, payment_reversals, agent_loan_assignments, and auto-number sequences.

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('DRAFT', 'APPROVED', 'DISBURSED', 'ACTIVE', 'OVERDUE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE schedule_status AS ENUM ('PENDING', 'PAID', 'MISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SEQUENCES (auto-numbering)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS loan_number_seq        START 1001 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS loan_payment_number_seq START 1001 INCREMENT 1;

-- ============================================================
-- LOANS
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number           TEXT          NOT NULL UNIQUE,
  customer_id           UUID          NOT NULL REFERENCES customers(id),
  branch_id             UUID          REFERENCES branches(id),
  loan_amount           NUMERIC(12,2) NOT NULL,
  interest_percentage   NUMERIC(5,2)  NOT NULL,
  interest_amount       NUMERIC(12,2) NOT NULL,
  disbursed_amount      NUMERIC(12,2) NOT NULL,
  daily_installment     NUMERIC(12,2) NOT NULL,
  penalty_amount        NUMERIC(12,2) NOT NULL,
  disbursement_date     DATE          NOT NULL,
  repayment_start_date  DATE          NOT NULL,
  principal_collected   NUMERIC(12,2) NOT NULL DEFAULT 0,
  principal_outstanding NUMERIC(12,2) NOT NULL,
  penalty_outstanding   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_outstanding     NUMERIC(12,2) NOT NULL,
  status                loan_status   NOT NULL DEFAULT 'DRAFT',
  assigned_agent_id     UUID          REFERENCES profiles(id),
  notes                 TEXT,
  created_by            UUID          REFERENCES profiles(id),
  foreclosure_enabled   BOOLEAN       DEFAULT FALSE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   DEFAULT now(),
  updated_at            TIMESTAMPTZ   DEFAULT now(),

  CONSTRAINT chk_loans_loan_amount_positive     CHECK (loan_amount > 0),
  CONSTRAINT chk_loans_interest_non_negative    CHECK (interest_percentage >= 0),
  CONSTRAINT chk_loans_daily_installment_positive CHECK (daily_installment > 0),
  CONSTRAINT chk_loans_penalty_non_negative     CHECK (penalty_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_agent    ON loans(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_loans_status   ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_branch   ON loans(branch_id);

-- ============================================================
-- LOAN SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_schedules (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id            UUID            NOT NULL REFERENCES loans(id),
  scheduled_date     DATE            NOT NULL,
  installment_amount NUMERIC(12,2)   NOT NULL,
  status             schedule_status NOT NULL DEFAULT 'PENDING',
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ     DEFAULT now(),
  updated_at         TIMESTAMPTZ     DEFAULT now(),

  CONSTRAINT uq_loan_schedules_loan_date UNIQUE (loan_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_loan_schedules_loan   ON loan_schedules(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_schedules_status ON loan_schedules(status);
CREATE INDEX IF NOT EXISTS idx_loan_schedules_date   ON loan_schedules(scheduled_date);

-- ============================================================
-- LOAN PENALTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_penalties (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id        UUID          NOT NULL REFERENCES loans(id),
  schedule_id    UUID          NOT NULL REFERENCES loan_schedules(id),
  penalty_amount NUMERIC(12,2) NOT NULL,
  is_waived      BOOLEAN       DEFAULT FALSE,
  waived_amount  NUMERIC(12,2) DEFAULT 0,
  waived_by      UUID          REFERENCES profiles(id),
  waived_at      TIMESTAMPTZ,
  waiver_reason  TEXT,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now(),

  CONSTRAINT uq_loan_penalties_schedule UNIQUE (loan_id, schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_loan_penalties_loan     ON loan_penalties(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_penalties_schedule ON loan_penalties(schedule_id);

-- ============================================================
-- LOAN PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_payments (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number        TEXT         NOT NULL UNIQUE,
  loan_id               UUID         NOT NULL REFERENCES loans(id),
  loan_schedule_id      UUID         NOT NULL REFERENCES loan_schedules(id),
  customer_id           UUID         NOT NULL REFERENCES customers(id),
  agent_id              UUID         NOT NULL REFERENCES profiles(id),
  branch_id             UUID         REFERENCES branches(id),
  scheduled_date        DATE         NOT NULL,
  payment_date          DATE         NOT NULL,
  amount                NUMERIC(12,2) NOT NULL,
  payment_type          TEXT         NOT NULL DEFAULT 'PRINCIPAL',
  payment_mode          payment_mode NOT NULL DEFAULT 'CASH',
  payment_reference     TEXT,
  transaction_reference TEXT,
  status                TEXT         NOT NULL DEFAULT 'CONFIRMED',
  is_reversed           BOOLEAN      DEFAULT FALSE,
  reversed_by           UUID         REFERENCES profiles(id),
  reversed_at           TIMESTAMPTZ,
  reversal_reason       TEXT,
  created_by            UUID         REFERENCES profiles(id),
  created_at            TIMESTAMPTZ  DEFAULT now(),
  updated_at            TIMESTAMPTZ  DEFAULT now(),

  CONSTRAINT chk_loan_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan           ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_customer       ON loan_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_agent          ON loan_payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_scheduled_date ON loan_payments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_schedule       ON loan_payments(loan_schedule_id);

-- Partial unique: only one non-reversed payment per schedule
CREATE UNIQUE INDEX IF NOT EXISTS uq_loan_payments_schedule_active
  ON loan_payments(loan_schedule_id) WHERE NOT is_reversed;

-- ============================================================
-- PAYMENT REVERSALS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_reversals (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_payment_id  UUID          NOT NULL REFERENCES loan_payments(id),
  loan_id          UUID          NOT NULL REFERENCES loans(id),
  reversal_amount  NUMERIC(12,2) NOT NULL,
  reason           TEXT          NOT NULL,
  reversed_by      UUID          NOT NULL REFERENCES profiles(id),
  reversed_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reversals_payment ON payment_reversals(loan_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_reversals_loan    ON payment_reversals(loan_id);

-- ============================================================
-- AGENT LOAN ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_loan_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id       UUID        NOT NULL REFERENCES loans(id),
  agent_id      UUID        NOT NULL REFERENCES profiles(id),
  assigned_by   UUID        REFERENCES profiles(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  is_current    BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_loan_assignments_loan  ON agent_loan_assignments(loan_id);
CREATE INDEX IF NOT EXISTS idx_agent_loan_assignments_agent ON agent_loan_assignments(agent_id);
