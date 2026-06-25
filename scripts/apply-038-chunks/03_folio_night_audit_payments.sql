-- Chunk 3/4

CREATE TABLE IF NOT EXISTS guest_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  description text NOT NULL CHECK (char_length(btrim(description)) > 0),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  charge_type text NOT NULL DEFAULT 'incidental' CHECK (
    charge_type IN ('room', 'incidental', 'tax', 'deposit', 'adjustment')
  ),
  posted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_charges_guest
  ON guest_charges (guest_id, created_at DESC);

ALTER TABLE guest_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_guest_charges" ON guest_charges;
CREATE POLICY "staff_read_guest_charges" ON guest_charges
  FOR SELECT
  USING (hotel_id = auth_hotel_id());

DROP POLICY IF EXISTS "staff_manage_guest_charges" ON guest_charges;
CREATE POLICY "staff_manage_guest_charges" ON guest_charges
  FOR ALL
  USING (
    auth_role() IN ('owner', 'manager', 'receptionist')
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() IN ('owner', 'manager', 'receptionist')
    AND hotel_id = auth_hotel_id()
  );

CREATE TABLE IF NOT EXISTS night_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  closed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rooms_occupied int NOT NULL DEFAULT 0,
  rooms_available int NOT NULL DEFAULT 0,
  arrivals int NOT NULL DEFAULT 0,
  departures int NOT NULL DEFAULT 0,
  revenue_posted numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_night_audits_hotel_date
  ON night_audits (hotel_id, business_date DESC);

ALTER TABLE night_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manager_read_night_audits" ON night_audits;
CREATE POLICY "owner_manager_read_night_audits" ON night_audits
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

DROP POLICY IF EXISTS "owner_manager_close_night_audit" ON night_audits;
CREATE POLICY "owner_manager_close_night_audit" ON night_audits
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('paystack', 'hubtel', 'manual')),
  provider_reference text,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'success', 'failed', 'refunded')
  ),
  metadata jsonb,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_records_hotel
  ON payment_records (hotel_id, created_at DESC);

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_payment_records" ON payment_records;
CREATE POLICY "owner_read_payment_records" ON payment_records
  FOR SELECT
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

DROP POLICY IF EXISTS "owner_manage_payment_records" ON payment_records;
CREATE POLICY "owner_manage_payment_records" ON payment_records
  FOR ALL
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

COMMENT ON TABLE guest_charges IS 'Running folio line items posted during a guest stay.';
COMMENT ON TABLE night_audits IS 'End-of-day close snapshot per business date.';
COMMENT ON TABLE payment_records IS 'Online and manual payment reconciliation.';
