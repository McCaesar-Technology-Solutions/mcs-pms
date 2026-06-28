-- Technicians schedule visits while status is still 'assigned' (or in_progress / rejected).
-- Old WITH CHECK only allowed in_progress | pending_approval, so visit updates failed RLS.

DROP POLICY IF EXISTS "technician_update_status" ON complaints;

CREATE POLICY "technician_update_status" ON complaints
  FOR UPDATE
  USING (
    auth_role() = 'technician'
    AND assigned_to = auth.uid()
    AND status IN ('assigned', 'in_progress', 'pending_approval', 'rejected')
  )
  WITH CHECK (
    auth_role() = 'technician'
    AND assigned_to = auth.uid()
    AND status IN ('assigned', 'in_progress', 'pending_approval', 'rejected')
  );
