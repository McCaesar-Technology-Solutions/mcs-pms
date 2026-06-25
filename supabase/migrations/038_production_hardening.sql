-- Production hardening: security, folio, night audit, notifications, SLA, no-show.

-- ---------------------------------------------------------------------------
-- Rate limits: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE action_rate_limits ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Staff invites: expiry (7 days default for new rows)
-- ---------------------------------------------------------------------------
ALTER TABLE staff_invites
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

UPDATE staff_invites
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL OR expires_at < created_at;

-- ---------------------------------------------------------------------------
-- Manager invoice access: read-only (owner retains full control)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "manager_manage_invoices" ON invoices;

CREATE POLICY "manager_read_invoices" ON invoices
  FOR SELECT
  USING (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Receptionist: read housekeeping tasks at their hotel
-- ---------------------------------------------------------------------------
CREATE POLICY "receptionist_read_housekeeping" ON housekeeping_tasks
  FOR SELECT
  USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Reservation status: no_show
-- ---------------------------------------------------------------------------
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (
  status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')
);

-- ---------------------------------------------------------------------------
-- Complaint SLA due times
-- ---------------------------------------------------------------------------
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_complaints_sla_due
  ON complaints (hotel_id, sla_due_at)
  WHERE status NOT IN ('resolved', 'rejected') AND sla_due_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Guest folio charges (in-stay posting)
-- ---------------------------------------------------------------------------
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

CREATE POLICY "staff_read_guest_charges" ON guest_charges
  FOR SELECT
  USING (hotel_id = auth_hotel_id());

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

-- ---------------------------------------------------------------------------
-- Night audit (business date close)
-- ---------------------------------------------------------------------------
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

CREATE POLICY "owner_manager_read_night_audits" ON night_audits
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "owner_manager_close_night_audit" ON night_audits
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Payment records (Paystack / manual reconciliation)
-- ---------------------------------------------------------------------------
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

CREATE POLICY "owner_read_payment_records" ON payment_records
  FOR SELECT
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

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

-- ---------------------------------------------------------------------------
-- Notification outbox (retry / idempotency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES hotels(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  recipient text NOT NULL,
  template_key text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'dead')
  ),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_idempotency
  ON notification_outbox (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Realtime: guest portal messaging
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE complaint_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE guest_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE complaint_messages REPLICA IDENTITY FULL;
ALTER TABLE guest_requests REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- Storage RLS: block direct client access to private buckets
-- ---------------------------------------------------------------------------
CREATE POLICY "property_images_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'property-images');

CREATE POLICY "staff_property_images_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] IN (
      SELECT hotel_id::text FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager') AND is_active IS NOT FALSE
    )
  );

CREATE POLICY "staff_property_images_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] IN (
      SELECT hotel_id::text FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager') AND is_active IS NOT FALSE
    )
  );

CREATE POLICY "staff_property_images_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] IN (
      SELECT hotel_id::text FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager') AND is_active IS NOT FALSE
    )
  );

-- Private buckets: no anon/authenticated policies (service role only)

COMMENT ON TABLE guest_charges IS 'Running folio line items posted during a guest stay.';
COMMENT ON TABLE night_audits IS 'End-of-day close snapshot per business date.';
COMMENT ON TABLE payment_records IS 'Online and manual payment reconciliation.';
COMMENT ON TABLE notification_outbox IS 'Reliable notification delivery with retries.';
