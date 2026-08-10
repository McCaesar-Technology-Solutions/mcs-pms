-- Weekly rate option alongside nightly and monthly rates (reservations, rooms, categories).
-- Lock tables in a fixed order first to avoid deadlocks with concurrent app queries.

SET lock_timeout = '15s';
SET deadlock_timeout = '1s';

LOCK TABLE room_categories, rooms, reservations IN ACCESS EXCLUSIVE MODE;

ALTER TABLE room_categories
  ADD COLUMN IF NOT EXISTS default_weekly_rate numeric(10,2);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_categories_default_weekly_rate_check'
  ) THEN
    ALTER TABLE room_categories
      ADD CONSTRAINT room_categories_default_weekly_rate_check
      CHECK (default_weekly_rate IS NULL OR default_weekly_rate >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_weekly_rate_check'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_weekly_rate_check
      CHECK (weekly_rate IS NULL OR weekly_rate >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_weekly_rate_check'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_weekly_rate_check
      CHECK (weekly_rate IS NULL OR weekly_rate >= 0);
  END IF;
END $$;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_rate_type_check;
ALTER TABLE reservations
  ADD CONSTRAINT reservations_rate_type_check
  CHECK (rate_type IN ('nightly', 'weekly', 'monthly'));

COMMENT ON COLUMN reservations.rate_type IS
  'nightly = per night; weekly = prorated from weekly_rate / 7 per night; monthly = prorated from monthly_rate / 30 per night';
