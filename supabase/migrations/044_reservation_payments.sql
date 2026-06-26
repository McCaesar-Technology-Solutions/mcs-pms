-- Reservation payment snapshot (invoice remains payment ledger after checkout)

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_payment_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_payment_status_check CHECK (
  payment_status IN (
    'unpaid', 'deposit_paid', 'pending', 'partial', 'paid', 'overdue', 'refunded', 'complimentary'
  )
);

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_payment_method_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_payment_method_check CHECK (
  payment_method IS NULL OR payment_method IN (
    'mtn_momo', 'telecel_cash', 'airteltigo', 'visa', 'mastercard', 'cash', 'bank_transfer'
  )
);

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_reservation
  ON payment_records (reservation_id, created_at DESC)
  WHERE reservation_id IS NOT NULL;

-- Backfill from linked invoices (checked-out stays)
UPDATE reservations r
SET
  amount_paid = COALESCE(inv.amount_paid, 0),
  payment_status = COALESCE(inv.payment_status, 'pending'),
  payment_method = inv.payment_method
FROM invoices inv
WHERE inv.reservation_id = r.id
  AND r.status = 'checked_out';

-- Checked-out without invoice: treat as pending
UPDATE reservations
SET payment_status = 'pending', amount_paid = 0
WHERE status = 'checked_out'
  AND payment_status = 'unpaid'
  AND amount_paid = 0
  AND id NOT IN (SELECT reservation_id FROM invoices WHERE reservation_id IS NOT NULL);

COMMENT ON COLUMN reservations.payment_status IS 'Ops snapshot: pre-checkout deposit states or synced from invoice after checkout.';
COMMENT ON COLUMN reservations.amount_paid IS 'Cumulative collected against this stay (deposits + invoice payments).';
COMMENT ON COLUMN reservations.deposit_amount IS 'Expected deposit at booking; informational for staff.';
