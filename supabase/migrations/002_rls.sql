ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auth_hotel_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hotel_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE POLICY "owner_read_all" ON hotels
  FOR SELECT USING (id = auth_hotel_id());

CREATE POLICY "read_own_hotel_profiles" ON profiles
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE POLICY "owner_manage_managers" ON profiles
  FOR ALL USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
    AND role = 'manager'
  );

CREATE POLICY "manager_manage_technicians" ON profiles
  FOR ALL USING (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
    AND role = 'technician'
  );

CREATE POLICY "staff_read_rooms" ON rooms
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE POLICY "manager_update_rooms" ON rooms
  FOR UPDATE USING (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "manager_manage_guests" ON guests
  FOR ALL USING (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "staff_read_reservations" ON reservations
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE POLICY "manager_manage_reservations" ON reservations
  FOR ALL USING (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "manager_owner_read_complaints" ON complaints
  FOR SELECT USING (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "technician_read_assigned" ON complaints
  FOR SELECT USING (
    auth_role() = 'technician'
    AND assigned_to = auth.uid()
  );

CREATE POLICY "technician_update_status" ON complaints
  FOR UPDATE USING (
    auth_role() = 'technician'
    AND assigned_to = auth.uid()
    AND status IN ('assigned','in_progress','pending_approval')
  )
  WITH CHECK (
    status IN ('in_progress','pending_approval')
  );

CREATE POLICY "manager_update_complaints" ON complaints
  FOR UPDATE USING (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "staff_read_complaint_events" ON complaint_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_events.complaint_id
      AND (
        (auth_role() IN ('manager','owner') AND c.hotel_id = auth_hotel_id())
        OR (auth_role() = 'technician' AND c.assigned_to = auth.uid())
      )
    )
  );

CREATE POLICY "staff_insert_complaint_events" ON complaint_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_events.complaint_id
      AND (
        (auth_role() IN ('manager','owner') AND c.hotel_id = auth_hotel_id())
        OR (auth_role() = 'technician' AND c.assigned_to = auth.uid())
      )
    )
  );

CREATE POLICY "owner_read_invoices" ON invoices
  FOR SELECT USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "manager_manage_invoices" ON invoices
  FOR ALL USING (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "owner_manage_staff_invites" ON staff_invites
  FOR ALL USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "manager_read_staff_invites" ON staff_invites
  FOR SELECT USING (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
  );
