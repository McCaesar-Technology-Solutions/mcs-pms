-- Receptionists (and all staff) must be able to read their own profile row.
-- Migration 014 removed the broad hotel profile policy but never added self-read;
-- sign-in then sees no profile and reports "account disabled".

CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "receptionist_read_hotel_profiles" ON profiles
  FOR SELECT USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
    AND role IN ('manager', 'receptionist', 'technician')
  );

-- Correct typo from 014 (auth_hotel_id()9) if this policy was never applied cleanly.
DROP POLICY IF EXISTS "technician_read_limited_profiles" ON profiles;
CREATE POLICY "technician_read_limited_profiles" ON profiles
  FOR SELECT USING (
    auth_role() = 'technician'
    AND hotel_id = auth_hotel_id()
    AND role IN ('manager', 'technician')
  );

CREATE POLICY "staff_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
