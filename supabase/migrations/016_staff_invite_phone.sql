-- Technician invites are created with a phone number; managers still use email.

ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS idx_staff_invites_hotel_phone_pending
  ON staff_invites (hotel_id, phone)
  WHERE accepted = false AND phone IS NOT NULL;
