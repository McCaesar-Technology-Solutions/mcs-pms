-- Chunk 4/4 — realtime + storage policies last (most likely to conflict with live app)

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

COMMENT ON TABLE notification_outbox IS 'Reliable notification delivery with retries.';

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

DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
CREATE POLICY "property_images_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "staff_property_images_upload" ON storage.objects;
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

DROP POLICY IF EXISTS "staff_property_images_update" ON storage.objects;
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

DROP POLICY IF EXISTS "staff_property_images_delete" ON storage.objects;
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
