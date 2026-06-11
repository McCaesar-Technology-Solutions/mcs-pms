-- Staff phone numbers for guest ↔ manager ↔ technician contact.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
