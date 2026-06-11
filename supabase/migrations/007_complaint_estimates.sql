-- Technician cost estimates for assigned complaints (materials + labour).

ALTER TABLE complaint_events DROP CONSTRAINT IF EXISTS complaint_events_event_type_check;

ALTER TABLE complaint_events ADD CONSTRAINT complaint_events_event_type_check
  CHECK (event_type IN (
    'submitted', 'assigned', 'started', 'completion_requested',
    'rejected', 'resolved', 'estimate_submitted'
  ));

CREATE TABLE IF NOT EXISTS complaint_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES profiles(id),
  note text,
  labour_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (labour_cost >= 0),
  materials_total numeric(10,2) NOT NULL DEFAULT 0 CHECK (materials_total >= 0),
  total_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_estimates_hotel ON complaint_estimates (hotel_id);
CREATE INDEX IF NOT EXISTS idx_complaint_estimates_technician ON complaint_estimates (technician_id);

CREATE TABLE IF NOT EXISTS complaint_estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES complaint_estimates(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_total numeric(10,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_complaint_estimate_items_estimate ON complaint_estimate_items (estimate_id);

ALTER TABLE complaint_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_estimate_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technician_manage_estimates" ON complaint_estimates;
DROP POLICY IF EXISTS "technician_read_own_estimates" ON complaint_estimates;
DROP POLICY IF EXISTS "staff_read_estimates" ON complaint_estimates;
DROP POLICY IF EXISTS "technician_manage_estimate_items" ON complaint_estimate_items;
DROP POLICY IF EXISTS "technician_read_estimate_items" ON complaint_estimate_items;
DROP POLICY IF EXISTS "staff_read_estimate_items" ON complaint_estimate_items;

-- Technicians read their own estimates (writes use service role in server action).
CREATE POLICY "technician_read_own_estimates" ON complaint_estimates
  FOR SELECT USING (
    auth_role() = 'technician'
    AND technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_estimates.complaint_id
        AND c.assigned_to = auth.uid()
    )
  );

CREATE POLICY "staff_read_estimates" ON complaint_estimates
  FOR SELECT USING (
    auth_role() IN ('manager', 'owner')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "technician_read_estimate_items" ON complaint_estimate_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaint_estimates e
      WHERE e.id = complaint_estimate_items.estimate_id
        AND auth_role() = 'technician'
        AND e.technician_id = auth.uid()
    )
  );

CREATE POLICY "staff_read_estimate_items" ON complaint_estimate_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaint_estimates e
      WHERE e.id = complaint_estimate_items.estimate_id
        AND auth_role() IN ('manager', 'owner')
        AND e.hotel_id = auth_hotel_id()
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE complaint_estimates;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
