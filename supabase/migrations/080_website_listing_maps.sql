-- Map public website listings (mojo hotels) to PMS hotels / rooms.
-- Website Request-to-Book enquiries create provisional reservations here.

CREATE TABLE website_listing_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  website_property_id uuid NOT NULL,
  website_slug text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_listing_maps_room_hotel_chk CHECK (
    room_id IS NULL OR hotel_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX idx_website_listing_maps_property
  ON website_listing_maps (website_property_id);

CREATE INDEX idx_website_listing_maps_hotel
  ON website_listing_maps (hotel_id)
  WHERE is_active = true;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS website_enquiry_id uuid;

CREATE UNIQUE INDEX idx_reservations_website_enquiry
  ON reservations (website_enquiry_id)
  WHERE website_enquiry_id IS NOT NULL;

ALTER TABLE website_listing_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_website_listing_maps" ON website_listing_maps
  FOR ALL USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "staff_read_website_listing_maps" ON website_listing_maps
  FOR SELECT USING (
    auth_role() IN ('owner', 'manager', 'receptionist')
    AND hotel_id = auth_hotel_id()
  );

COMMENT ON TABLE website_listing_maps IS
  'Links a public website property UUID to this PMS hotel (optional specific room).';

COMMENT ON COLUMN reservations.website_enquiry_id IS
  'Idempotency key: enquiry id from the public website Request-to-Book form.';
