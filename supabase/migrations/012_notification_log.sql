-- Audit trail for outbound SMS/WhatsApp (optional; writes use service role)

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES hotels(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  template_key text NOT NULL,
  body text NOT NULL,
  provider text,
  provider_id text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_hotel ON notification_log (hotel_id, created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_notification_log" ON notification_log
  FOR SELECT USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );
