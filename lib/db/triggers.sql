-- Drizzle managed schema (generated via drizzle-kit push)
-- This file documents the triggers that are applied post-migration

-- Auto-generate collection number
CREATE SEQUENCE IF NOT EXISTS collection_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_collection_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.collection_number IS NULL OR NEW.collection_number = '' THEN
    NEW.collection_number := 'COL-' || LPAD(nextval('collection_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_collection_number ON collections;
CREATE TRIGGER set_collection_number
  BEFORE INSERT ON collections
  FOR EACH ROW EXECUTE FUNCTION generate_collection_number();

-- Recalculate due outstanding after collection confirmed/updated
CREATE OR REPLACE FUNCTION recalculate_due_outstanding()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_amount NUMERIC(12,2);
  paid NUMERIC(12,2);
  due_id_val UUID;
BEGIN
  due_id_val := COALESCE(NEW.due_id, OLD.due_id);
  IF due_id_val IS NULL THEN RETURN NEW; END IF;

  SELECT amount INTO total_amount FROM dues WHERE id = due_id_val;
  SELECT COALESCE(SUM(amount), 0) INTO paid
    FROM collections
    WHERE due_id = due_id_val AND status = 'CONFIRMED';

  UPDATE dues SET
    outstanding_amount = GREATEST(total_amount - paid, 0),
    status = CASE
      WHEN GREATEST(total_amount - paid, 0) = 0 THEN 'PAID'
      WHEN paid > 0 THEN 'PARTIALLY_PAID'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = due_id_val;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_due_after_collection ON collections;
CREATE TRIGGER update_due_after_collection
  AFTER INSERT OR UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION recalculate_due_outstanding();

-- Auto-calculate attendance hours and status
CREATE OR REPLACE FUNCTION calculate_attendance_hours()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NOT NULL THEN
    NEW.total_hours := ROUND(EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at)) / 3600.0, 2);
    IF NEW.total_hours >= 8 THEN
      NEW.status := 'PRESENT';
    ELSIF NEW.total_hours >= 4 THEN
      NEW.status := 'HALF_DAY';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calc_hours_on_attendance ON attendance;
CREATE TRIGGER calc_hours_on_attendance
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION calculate_attendance_hours();
