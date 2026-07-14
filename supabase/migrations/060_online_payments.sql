-- Online guest→hotel payments (Paystack) + audit entity for payment rows

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (
  entity_type IN (
    'reservation',
    'room',
    'room_category',
    'hotel',
    'staff',
    'guest',
    'invoice',
    'complaint',
    'guest_request',
    'payment'
  )
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('paystack')),
  provider_reference text NOT NULL,
  provider_transaction_id text,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  channel text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'success', 'failed', 'abandoned', 'refunded')
  ),
  initiated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  guest_portal_initiated boolean NOT NULL DEFAULT false,
  authorization_url text,
  raw_webhook_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_provider_reference_unique UNIQUE (provider_reference)
);

CREATE INDEX IF NOT EXISTS idx_payments_hotel_status
  ON payments (hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_hotel_guest
  ON payments (hotel_id, guest_id);

CREATE INDEX IF NOT EXISTS idx_payments_hotel_created
  ON payments (hotel_id, created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_staff_select ON payments;

-- Staff may read hotel-scoped payment rows. All inserts/updates go through
-- createAdminClient() (service role) from server actions and the webhook.
CREATE POLICY payments_staff_select ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = payments.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
    )
  );
