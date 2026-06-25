-- Chunk 1/4 — run alone after stopping dev server and other SQL tabs

ALTER TABLE action_rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff_invites
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

UPDATE staff_invites
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL OR expires_at < created_at;

DROP POLICY IF EXISTS "manager_manage_invoices" ON invoices;

CREATE POLICY "manager_read_invoices" ON invoices
  FOR SELECT
  USING (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "receptionist_read_housekeeping" ON housekeeping_tasks
  FOR SELECT
  USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
  );
