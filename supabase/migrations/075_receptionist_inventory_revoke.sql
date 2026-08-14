-- Receptionists no longer access inventory (items or movements).
-- Owner/manager retain full RLS; technicians consume stock via service-role actions.

DROP POLICY IF EXISTS inventory_staff ON inventory_items;
CREATE POLICY inventory_staff ON inventory_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_items.hotel_id
        AND p.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_items.hotel_id
        AND p.role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS inventory_movements_staff ON inventory_movements;
CREATE POLICY inventory_movements_staff ON inventory_movements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_movements.hotel_id
        AND p.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_movements.hotel_id
        AND p.role IN ('owner', 'manager')
    )
  );
