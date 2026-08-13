-- Guest stay discounts (pre-tax) + folio discount charge type.
-- Additive / dual-run safe: existing rows default to no discount.

-- ---------------------------------------------------------------------------
-- Reservations: discount configuration
-- ---------------------------------------------------------------------------
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none'
    CHECK (discount_type IN ('none', 'percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (discount_value >= 0),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS discount_reason text;

COMMENT ON COLUMN reservations.discount_type IS
  'none | percent | fixed — applied to pre-tax room stay base before GRA taxes.';
COMMENT ON COLUMN reservations.discount_value IS
  'Percent (0–100) or fixed GHS amount depending on discount_type.';
COMMENT ON COLUMN reservations.discount_amount IS
  'Computed GHS discount last saved (capped at stay base).';

-- ---------------------------------------------------------------------------
-- Invoices: discount snapshot at issue
-- ---------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS discount_reason text;

COMMENT ON COLUMN invoices.discount_amount IS
  'Snapshot of pre-tax discount applied when the invoice was issued/refreshed.';
COMMENT ON COLUMN invoices.discount_reason IS
  'Optional reason copied from the reservation at issue.';

-- ---------------------------------------------------------------------------
-- Folio: dedicated discount charge type (credits; amount stored negative)
-- ---------------------------------------------------------------------------
ALTER TABLE guest_charges DROP CONSTRAINT IF EXISTS guest_charges_charge_type_check;
ALTER TABLE guest_charges
  ADD CONSTRAINT guest_charges_charge_type_check
  CHECK (charge_type IN ('room', 'incidental', 'tax', 'deposit', 'adjustment', 'discount'));

COMMENT ON COLUMN guest_charges.charge_type IS
  'room/incidental/tax/deposit/adjustment = debit; discount = credit (negative amount).';
