-- Guest portal: property info, requests, feedback, complaint photos & chat, DND.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS guest_portal_wifi_ssid text,
  ADD COLUMN IF NOT EXISTS guest_portal_wifi_password text,
  ADD COLUMN IF NOT EXISTS guest_portal_parking text,
  ADD COLUMN IF NOT EXISTS guest_portal_emergency_phone text,
  ADD COLUMN IF NOT EXISTS guest_portal_check_out_time text DEFAULT '11:00 AM',
  ADD COLUMN IF NOT EXISTS guest_portal_welcome text;

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS do_not_disturb boolean NOT NULL DEFAULT false;

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS guest_photo_path text,
  ADD COLUMN IF NOT EXISTS guest_photo_mime text;

CREATE TABLE IF NOT EXISTS hotel_local_guide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_local_guide_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT hotel_local_guide_body_nonempty CHECK (char_length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_hotel_local_guide_hotel_sort
  ON hotel_local_guide (hotel_id, sort_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS guest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (
    request_type IN ('housekeeping', 'late_checkout', 'extension', 'self_checkout')
  ),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'acknowledged', 'completed', 'declined')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_requests_hotel_created
  ON guest_requests (hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guest_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  complaint_id uuid REFERENCES complaints(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_feedback_hotel_created
  ON guest_feedback (hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS complaint_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('guest', 'staff')),
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaint_messages_body_nonempty CHECK (char_length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint_created
  ON complaint_messages (complaint_id, created_at ASC);

ALTER TABLE hotel_local_guide ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read_hotel_local_guide ON hotel_local_guide
  FOR SELECT USING (
    hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_manage_hotel_local_guide ON hotel_local_guide
  FOR ALL USING (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE AND p.role IN ('owner', 'manager')
    )
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  )
  WITH CHECK (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE AND p.role IN ('owner', 'manager')
    )
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_read_guest_requests ON guest_requests
  FOR SELECT USING (
    hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_update_guest_requests ON guest_requests
  FOR UPDATE USING (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE AND p.role IN ('owner', 'manager', 'receptionist')
    )
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_read_guest_feedback ON guest_feedback
  FOR SELECT USING (
    hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_read_complaint_messages ON complaint_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_messages.complaint_id
        AND (
          c.hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
          OR c.hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
        )
    )
  );

CREATE POLICY staff_insert_complaint_messages ON complaint_messages
  FOR INSERT WITH CHECK (
    author_role = 'staff'
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_messages.complaint_id
        AND (
          c.hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
          OR c.hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
        )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guest-complaint-photos',
  'guest-complaint-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
