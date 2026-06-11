-- Custom room categories per property + per-room nightly rates.

CREATE TABLE IF NOT EXISTS room_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_nightly_rate numeric(10,2) NOT NULL DEFAULT 0 CHECK (default_nightly_rate >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, name)
);

CREATE INDEX IF NOT EXISTS idx_room_categories_hotel ON room_categories (hotel_id);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES room_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nightly_rate numeric(10,2) CHECK (nightly_rate IS NULL OR nightly_rate >= 0);

-- Default categories for every hotel (including properties with no rooms yet).
INSERT INTO room_categories (hotel_id, name, default_nightly_rate)
SELECT h.id, v.name, v.rate
FROM hotels h
CROSS JOIN (
  VALUES ('Standard', 250::numeric), ('Deluxe', 380::numeric), ('Suite', 550::numeric)
) AS v(name, rate)
ON CONFLICT (hotel_id, name) DO NOTHING;

-- Backfill existing rooms from legacy type enum (if column still exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rooms'
      AND column_name = 'type'
  ) THEN
    UPDATE rooms r
    SET
      category_id = c.id,
      nightly_rate = COALESCE(r.nightly_rate, c.default_nightly_rate)
    FROM room_categories c
    WHERE c.hotel_id = r.hotel_id
      AND c.name = CASE COALESCE(r.type, 'standard')
        WHEN 'deluxe' THEN 'Deluxe'
        WHEN 'suite' THEN 'Suite'
        ELSE 'Standard'
      END
      AND r.category_id IS NULL;
  ELSE
    -- Re-run safe: type already dropped — assign Standard to uncategorized rooms.
    UPDATE rooms r
    SET
      category_id = c.id,
      nightly_rate = COALESCE(r.nightly_rate, c.default_nightly_rate)
    FROM room_categories c
    WHERE c.hotel_id = r.hotel_id
      AND c.name = 'Standard'
      AND r.category_id IS NULL;
  END IF;
END $$;

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_check;
ALTER TABLE rooms DROP COLUMN IF EXISTS type;

ALTER TABLE room_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_room_categories" ON room_categories;

CREATE POLICY "staff_manage_room_categories" ON room_categories
  FOR ALL USING (
    auth_role() IN ('manager', 'owner')
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() IN ('manager', 'owner')
    AND hotel_id = auth_hotel_id()
  );
