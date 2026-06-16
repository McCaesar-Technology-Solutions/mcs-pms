-- Monthly rate option alongside nightly rates (reservations, rooms, categories).

ALTER TABLE room_categories
  ADD COLUMN IF NOT EXISTS default_monthly_rate numeric(10,2)
    CHECK (default_monthly_rate IS NULL OR default_monthly_rate >= 0);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS monthly_rate numeric(10,2)
    CHECK (monthly_rate IS NULL OR monthly_rate >= 0);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS rate_type text NOT NULL DEFAULT 'nightly'
    CHECK (rate_type IN ('nightly', 'monthly')),
  ADD COLUMN IF NOT EXISTS monthly_rate numeric(10,2)
    CHECK (monthly_rate IS NULL OR monthly_rate >= 0);

COMMENT ON COLUMN reservations.rate_type IS 'nightly = per night; monthly = prorated from monthly_rate / 30 per night';
