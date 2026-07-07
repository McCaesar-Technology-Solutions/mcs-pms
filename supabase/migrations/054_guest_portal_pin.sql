-- Guest portal access PIN.
--
-- The self-service portal entry (scan property QR → enter room number) previously
-- authenticated a guest with only their room number and last name — both easy to
-- observe or guess for an in-house guest. This adds a per-guest numeric PIN issued
-- by the front desk at check-in, so entry requires room number + PIN.

ALTER TABLE guests ADD COLUMN IF NOT EXISTS portal_pin text;

-- Backfill a random 4-digit PIN for every existing guest so current in-house
-- guests can keep using the portal (staff can read it from the guest record).
UPDATE guests
SET portal_pin = lpad((floor(random() * 10000))::int::text, 4, '0')
WHERE portal_pin IS NULL;

COMMENT ON COLUMN guests.portal_pin IS
  'Front-desk-issued numeric PIN for self-service guest portal room entry.';
