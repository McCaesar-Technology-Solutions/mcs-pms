-- Monthly and yearly period audits (same snapshot model as night_audits).

CREATE TABLE IF NOT EXISTS period_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
  period_year int NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month int CHECK (period_month IS NULL OR (period_month >= 1 AND period_month <= 12)),
  period_key text NOT NULL,
  closed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rooms_occupied int NOT NULL DEFAULT 0,
  rooms_available int NOT NULL DEFAULT 0,
  arrivals int NOT NULL DEFAULT 0,
  departures int NOT NULL DEFAULT 0,
  revenue_posted numeric(12,2) NOT NULL DEFAULT 0,
  night_audits_count int NOT NULL DEFAULT 0,
  notes text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_audits_month_required CHECK (
    (period_type = 'monthly' AND period_month IS NOT NULL)
    OR (period_type = 'yearly' AND period_month IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_period_audits_hotel_monthly
  ON period_audits (hotel_id, period_key)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX IF NOT EXISTS idx_period_audits_hotel_yearly
  ON period_audits (hotel_id, period_year)
  WHERE period_type = 'yearly';

CREATE INDEX IF NOT EXISTS idx_period_audits_hotel_closed
  ON period_audits (hotel_id, period_type, closed_at DESC);

ALTER TABLE period_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY period_audits_owner_manager_read ON period_audits
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY period_audits_owner_manager_insert ON period_audits
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

COMMENT ON TABLE period_audits IS 'Monthly and yearly business closes — aggregated ops snapshot per calendar period.';
