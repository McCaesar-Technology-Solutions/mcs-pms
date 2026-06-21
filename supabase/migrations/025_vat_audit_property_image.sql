-- VAT treatment mode, property profile images, and staff audit log.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'exclusive'
    CHECK (vat_mode IN ('exclusive', 'inclusive')),
  ADD COLUMN IF NOT EXISTS profile_image_path text;

COMMENT ON COLUMN hotels.vat_mode IS
  'exclusive: room rates exclude taxes (added at checkout). inclusive: rates include VAT and levies.';
COMMENT ON COLUMN hotels.profile_image_path IS
  'Supabase Storage path in property-images bucket.';

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles ON DELETE SET NULL,
  actor_name text,
  entity_type text NOT NULL CHECK (
    entity_type IN ('reservation', 'room', 'room_category')
  ),
  entity_id uuid,
  action text NOT NULL,
  summary text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_hotel ON audit_log (hotel_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_audit_log" ON audit_log
  FOR SELECT
  USING (
    hotel_id IN (
      SELECT hotel_id FROM profiles WHERE id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
