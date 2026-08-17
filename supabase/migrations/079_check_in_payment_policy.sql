-- Hotel-configurable minimum payment required at check-in (partial payments).

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS check_in_payment_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS check_in_payment_value numeric NOT NULL DEFAULT 50;

ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS hotels_check_in_payment_mode_check;

ALTER TABLE hotels
  ADD CONSTRAINT hotels_check_in_payment_mode_check
  CHECK (check_in_payment_mode IN ('none', 'percent', 'fixed', 'first_night'));

ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS hotels_check_in_payment_value_check;

ALTER TABLE hotels
  ADD CONSTRAINT hotels_check_in_payment_value_check
  CHECK (check_in_payment_value >= 0);

COMMENT ON COLUMN hotels.check_in_payment_mode IS
  'Minimum payment at check-in: none, percent of stay total, fixed GHS, or first night rate.';

COMMENT ON COLUMN hotels.check_in_payment_value IS
  'Mode-specific value: percent 0–100, fixed GHS amount, or unused for none/first_night.';
