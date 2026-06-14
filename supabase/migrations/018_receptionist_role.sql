-- Receptionist (front desk) role.
--
-- Capabilities: reservations + check-in/out, guest directory & portal links,
-- room status changes, logging complaints, and read-only complaint visibility.
-- Excluded (enforced in the app layer): billing, GRA, analytics, property
-- settings, room prices/inventory, and complaint assignment/approval.
--
-- Safe to re-run: every policy/constraint is dropped first.

-- 1. Allow the new role value on profiles + staff invites.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'manager', 'technician', 'receptionist'));

ALTER TABLE staff_invites DROP CONSTRAINT IF EXISTS staff_invites_role_check;
ALTER TABLE staff_invites ADD CONSTRAINT staff_invites_role_check
  CHECK (role IN ('manager', 'technician', 'receptionist'));

-- 2. Reservations — full lifecycle (create, check-in/out, extend, move, cancel).
DROP POLICY IF EXISTS "manager_manage_reservations" ON reservations;
CREATE POLICY "manager_manage_reservations" ON reservations
  FOR ALL USING (
    auth_role() IN ('manager', 'owner', 'receptionist')
    AND hotel_id = auth_hotel_id()
  );

-- 3. Guests — front desk reads the directory (writes run through server actions).
DROP POLICY IF EXISTS "receptionist_read_guests" ON guests;
CREATE POLICY "receptionist_read_guests" ON guests
  FOR SELECT USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
  );

-- 4. Complaints — read the full lifecycle (logging runs through a server action).
DROP POLICY IF EXISTS "receptionist_read_complaints" ON complaints;
CREATE POLICY "receptionist_read_complaints" ON complaints
  FOR SELECT USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
  );

DROP POLICY IF EXISTS "receptionist_read_complaint_events" ON complaint_events;
CREATE POLICY "receptionist_read_complaint_events" ON complaint_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_events.complaint_id
        AND auth_role() = 'receptionist'
        AND c.hotel_id = auth_hotel_id()
    )
  );

-- 5. Complaint invoices — read so totals show in the complaint detail view.
DROP POLICY IF EXISTS "staff_read_estimates" ON complaint_estimates;
CREATE POLICY "staff_read_estimates" ON complaint_estimates
  FOR SELECT USING (
    auth_role() IN ('manager', 'owner', 'receptionist')
    AND hotel_id = auth_hotel_id()
  );

DROP POLICY IF EXISTS "staff_read_estimate_items" ON complaint_estimate_items;
CREATE POLICY "staff_read_estimate_items" ON complaint_estimate_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaint_estimates e
      WHERE e.id = complaint_estimate_items.estimate_id
        AND auth_role() IN ('manager', 'owner', 'receptionist')
        AND e.hotel_id = auth_hotel_id()
    )
  );

-- 6. Rooms — front desk changes status only (price/inventory enforced in app).
DROP POLICY IF EXISTS "manager_update_rooms" ON rooms;
CREATE POLICY "manager_update_rooms" ON rooms
  FOR UPDATE USING (
    auth_role() IN ('manager', 'owner', 'receptionist')
    AND hotel_id = auth_hotel_id()
  );

-- 7. Room categories — read for the rooms screen (no editing).
DROP POLICY IF EXISTS "receptionist_read_room_categories" ON room_categories;
CREATE POLICY "receptionist_read_room_categories" ON room_categories
  FOR SELECT USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
  );
