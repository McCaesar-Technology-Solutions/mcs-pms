-- Snapshot guest Ghana Card onto invoices as tax ID (Bill-to).
-- guests.ghana_card_number already exists; this freezes the value at issue time
-- so privacy erase of the guest row does not strip historical invoices.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS guest_tax_id text;

COMMENT ON COLUMN invoices.guest_tax_id IS
  'Guest Ghana Card (GHA-#########-#) frozen at invoice issue for Bill-to / GRA.';

COMMENT ON COLUMN guests.ghana_card_number IS
  'Guest Ghana Card / NIA number. Copied to invoices.guest_tax_id at issue.';
