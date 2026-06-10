-- Housekeeping tasks
CREATE TABLE housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  room_id uuid REFERENCES rooms,
  task_type text NOT NULL CHECK (task_type IN ('clean','inspect','maintenance','restock')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  assigned_to uuid REFERENCES profiles,
  notes text,
  due_date date,
  created_by uuid REFERENCES profiles,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_housekeeping_tasks_hotel ON housekeeping_tasks (hotel_id);
CREATE INDEX idx_housekeeping_tasks_assigned ON housekeeping_tasks (assigned_to);

ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;

-- All staff in the hotel can read tasks
CREATE POLICY "staff_read_housekeeping" ON housekeeping_tasks
  FOR SELECT USING (hotel_id = auth_hotel_id());

-- Managers and owners can create/update/delete tasks
CREATE POLICY "manager_manage_housekeeping" ON housekeeping_tasks
  FOR ALL USING (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() IN ('manager','owner')
    AND hotel_id = auth_hotel_id()
  );

-- Assigned technicians can move their own tasks along
CREATE POLICY "technician_update_assigned_housekeeping" ON housekeeping_tasks
  FOR UPDATE USING (
    auth_role() = 'technician'
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    auth_role() = 'technician'
    AND assigned_to = auth.uid()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE housekeeping_tasks;
