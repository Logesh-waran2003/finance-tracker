-- Bootstrap Drizzle migration tracking table and mark existing migrations as applied.
-- Run this ONCE on any database that was built with db:push instead of drizzle-kit migrate.
-- After this, drizzle-kit migrate will apply only future migrations.

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);

-- Mark 0000_stale_archangel as applied
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'ba61f5efc4e8a98fc77a3bcbceb408ccbfaf9ea27daf22fb5518b40a179becf1', 1787660300612
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations 
  WHERE hash = 'ba61f5efc4e8a98fc77a3bcbceb408ccbfaf9ea27daf22fb5518b40a179becf1'
);

-- Mark 0001_hardening_and_constraints as applied
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '10d2e2bdc98b52ca27b6636b6dd7f9239b4721e31056f544bbc73f9121499b8c', 1787672733930
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations 
  WHERE hash = '10d2e2bdc98b52ca27b6636b6dd7f9239b4721e31056f544bbc73f9121499b8c'
);

SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
