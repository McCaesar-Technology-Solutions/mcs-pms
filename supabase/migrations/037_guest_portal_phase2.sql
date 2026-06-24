-- Guest portal phase 2: pre-arrival, request metadata, rate limits, ID storage.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS pre_arrival_eta text,
  ADD COLUMN IF NOT EXISTS pre_arrival_notes text,
  ADD COLUMN IF NOT EXISTS pre_arrival_id_path text,
  ADD COLUMN IF NOT EXISTS pre_arrival_id_mime text,
  ADD COLUMN IF NOT EXISTS pre_arrival_submitted_at timestamptz;

ALTER TABLE guest_requests
  ADD COLUMN IF NOT EXISTS requested_date date,
  ADD COLUMN IF NOT EXISTS requested_time text;

CREATE TABLE IF NOT EXISTS action_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_rate_limits_key_created
  ON action_rate_limits (rate_key, created_at DESC);

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
    'guest_request'
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guest-id-documents',
  'guest-id-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
