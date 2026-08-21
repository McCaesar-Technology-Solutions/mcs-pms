-- Unique stay invoices per original stay + each extension (not one cumulative stay bill).
-- Reservation stay totals remain an informational rollup.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS billing_period_start date,
  ADD COLUMN IF NOT EXISTS billing_period_end date;

COMMENT ON COLUMN invoices.billing_period_start IS
  'Inclusive start of this invoice’s stay segment (original stay or one extension).';
COMMENT ON COLUMN invoices.billing_period_end IS
  'Exclusive end (same convention as reservations.check_out).';

-- Legacy stay invoices covered the whole reservation.
UPDATE invoices i
SET
  billing_period_start = r.check_in,
  billing_period_end = r.check_out
FROM reservations r
WHERE i.reservation_id = r.id
  AND i.billing_period_start IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_reservation_billing_period
  ON invoices (reservation_id, billing_period_start)
  WHERE reservation_id IS NOT NULL
    AND billing_period_start IS NOT NULL;
