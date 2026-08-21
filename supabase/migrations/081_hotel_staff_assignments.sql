-- Managers may be assigned to multiple hotels owned by the same owner.
-- profiles.hotel_id remains the active working property (RLS via auth_hotel_id()).
-- Writes go through server actions (service role). Clients may only SELECT.

CREATE TABLE hotel_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'manager'
    CHECK (role = 'manager'),
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT hotel_staff_assignments_profile_hotel_unique UNIQUE (profile_id, hotel_id)
);

CREATE INDEX idx_hotel_staff_assignments_hotel_active
  ON hotel_staff_assignments (hotel_id)
  WHERE is_active = true;

CREATE INDEX idx_hotel_staff_assignments_profile_active
  ON hotel_staff_assignments (profile_id)
  WHERE is_active = true;

COMMENT ON TABLE hotel_staff_assignments IS
  'Which hotels a manager may work. profiles.hotel_id is the active property context.';

-- Existing managers: one assignment for their current hotel.
INSERT INTO hotel_staff_assignments (profile_id, hotel_id, role, assigned_by, is_active)
SELECT p.id, p.hotel_id, 'manager', p.invited_by, COALESCE(p.is_active, true)
FROM profiles p
WHERE p.role = 'manager'
  AND p.hotel_id IS NOT NULL
ON CONFLICT (profile_id, hotel_id) DO NOTHING;

ALTER TABLE hotel_staff_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY hotel_staff_assignments_select_own ON hotel_staff_assignments
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY hotel_staff_assignments_owner_select ON hotel_staff_assignments
  FOR SELECT USING (
    auth_role() = 'owner'
    AND (
      hotel_id = auth_hotel_id()
      OR EXISTS (
        SELECT 1 FROM hotels h
        WHERE h.id = hotel_staff_assignments.hotel_id
          AND h.owner_id = auth.uid()
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON hotel_staff_assignments FROM anon, authenticated;
GRANT SELECT ON hotel_staff_assignments TO authenticated;
