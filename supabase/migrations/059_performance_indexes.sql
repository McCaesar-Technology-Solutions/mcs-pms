-- Query performance indexes for staff dashboards, RLS subqueries, and inbox loads.

CREATE INDEX IF NOT EXISTS idx_profiles_hotel_id
  ON profiles (hotel_id)
  WHERE hotel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_hotel_check_in
  ON reservations (hotel_id, check_in DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_hotel_status_check_in
  ON reservations (hotel_id, status, check_in);

CREATE INDEX IF NOT EXISTS idx_complaints_hotel_submitted
  ON complaints (hotel_id, submitted_at DESC);
