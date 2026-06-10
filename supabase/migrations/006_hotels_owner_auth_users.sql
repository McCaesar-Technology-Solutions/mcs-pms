-- owner_id should reference auth.users, not profiles.
-- Signup creates the auth user before the profile is linked to a hotel.
-- Safe to re-run.

ALTER TABLE hotels DROP CONSTRAINT IF EXISTS hotels_owner_id_fkey;

ALTER TABLE hotels
  ADD CONSTRAINT hotels_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
