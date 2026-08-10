-- Weekly rate option alongside nightly and monthly rates (reservations, rooms, categories).

ALTER TABLE room_categories
  ADD COLUMN IF NOT EXISTS default_weekly_rate numeric(10,2)
    CHECK (default_weekly_rate IS NULL OR default_weekly_rate >= 0);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2)
    CHECK (weekly_rate IS NULL OR weekly_rate >= 0);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2)
    CHECK (weekly_rate IS NULL OR weekly_rate >= 0);

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_rate_type_check;
ALTER TABLE reservations
  ADD CONSTRAINT reservations_rate_type_check
  CHECK (rate_type IN ('nightly', 'weekly', 'monthly'));

COMMENT ON COLUMN reservations.rate_type IS
  'nightly = per night; weekly = prorated from weekly_rate / 7 per night; monthly = prorated from monthly_rate / 30 per night';
