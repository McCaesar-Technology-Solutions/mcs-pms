-- Optional bill-to name (when payer is not the stay guest) and frozen room category
-- for the invoice product line.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS bill_to_name text,
  ADD COLUMN IF NOT EXISTS room_category_name text;

COMMENT ON COLUMN invoices.bill_to_name IS
  'Payer printed on BILL TO. Null means same as guest_name.';

COMMENT ON COLUMN invoices.room_category_name IS
  'Room category snapshot at issue (e.g. Deluxe) for the PDF product column.';
