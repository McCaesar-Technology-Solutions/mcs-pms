-- Multi-property support for owners: each hotel belongs to an owner,
-- and profile.hotel_id remains the active property context for queries/RLS.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text;

-- FK added in 006 (auth.users). If 006 not applied yet, link owner_id to profiles for backfill only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hotels_owner_id_fkey'
  ) THEN
    ALTER TABLE hotels
      ADD CONSTRAINT hotels_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Link existing hotels to their owner profile.
UPDATE hotels h
SET owner_id = p.id
FROM profiles p
WHERE p.hotel_id = h.id
  AND p.role = 'owner'
  AND h.owner_id IS NULL;

DROP POLICY IF EXISTS "owner_read_all" ON hotels;
DROP POLICY IF EXISTS "owner_read_owned_hotels" ON hotels;
DROP POLICY IF EXISTS "owner_insert_hotels" ON hotels;
DROP POLICY IF EXISTS "owner_update_owned_hotels" ON hotels;

-- Owners see every hotel they own; staff see their assigned hotel.
CREATE POLICY "owner_read_owned_hotels" ON hotels
  FOR SELECT USING (
    (auth_role() = 'owner' AND owner_id = auth.uid())
    OR id = auth_hotel_id()
  );

CREATE POLICY "owner_insert_hotels" ON hotels
  FOR INSERT WITH CHECK (
    auth_role() = 'owner'
    AND owner_id = auth.uid()
  );

CREATE POLICY "owner_update_owned_hotels" ON hotels
  FOR UPDATE USING (
    auth_role() = 'owner'
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "owner_update_own_profile" ON profiles;

-- Owners may update their own profile (e.g. switch active hotel_id).
CREATE POLICY "owner_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
