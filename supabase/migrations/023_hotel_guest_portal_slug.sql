-- Property-level guest portal: scan QR → enter room number.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS guest_portal_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hotels_guest_portal_slug
  ON hotels (guest_portal_slug)
  WHERE guest_portal_slug IS NOT NULL;

COMMENT ON COLUMN hotels.guest_portal_slug IS
  'Short code for /guest/join/{slug} — stable so printed lobby QR codes do not break.';
