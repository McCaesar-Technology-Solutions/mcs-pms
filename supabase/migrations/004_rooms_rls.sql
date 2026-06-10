-- Rooms were missing INSERT and DELETE policies, so creating/deleting a room
-- was blocked by RLS even for authorized owners/managers. Add them here.

-- Managers and owners can create rooms in their own hotel
CREATE POLICY "manager_insert_rooms" ON rooms
  FOR INSERT WITH CHECK (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

-- Only owners can delete rooms in their own hotel
CREATE POLICY "owner_delete_rooms" ON rooms
  FOR DELETE USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );
