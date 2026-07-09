-- Inventory movement log + operational links

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL CHECK (
    reason IN ('received', 'used', 'adjusted', 'wasted', 'restock', 'clean', 'maintenance')
  ),
  note text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  housekeeping_task_id uuid REFERENCES housekeeping_tasks(id) ON DELETE SET NULL,
  complaint_id uuid REFERENCES complaints(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_hotel_created
  ON inventory_movements (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
  ON inventory_movements (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_complaint
  ON inventory_movements (complaint_id)
  WHERE complaint_id IS NOT NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_received integer CHECK (quantity_received IS NULL OR quantity_received > 0);

ALTER TABLE complaint_estimate_items
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL;

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movements_staff ON inventory_movements;

CREATE POLICY inventory_movements_staff ON inventory_movements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_movements.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_movements.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
    )
  );
