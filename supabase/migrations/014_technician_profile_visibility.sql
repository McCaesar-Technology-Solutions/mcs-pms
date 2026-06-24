-- Technicians may read manager/technician profiles at their hotel, not owners.

DROP POLICY IF EXISTS "read_own_hotel_profiles" ON profiles;

CREATE POLICY "owner_manager_read_hotel_profiles" ON profiles
  FOR SELECT USING (
    hotel_id = auth_hotel_id()
    AND auth_role() IN ('owner', 'manager')
  );

CREATE POLICY "technician_read_limited_profiles" ON profiles
  FOR SELECT USING (
    auth_role() = 'technician'
    AND hotel_id = auth_hotel_id()
    AND role IN ('manager', 'technician')
  );
