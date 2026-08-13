-- Receptionists may read invoices for their active hotel (payments still via service role).
-- Managers already have manager_read_invoices (038).

CREATE POLICY "receptionist_read_invoices" ON invoices
  FOR SELECT
  USING (
    auth_role() = 'receptionist'
    AND hotel_id = auth_hotel_id()
  );
