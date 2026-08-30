-- Add office GPS coordinates to branches
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS office_lat  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS office_lng  numeric(10, 7);
