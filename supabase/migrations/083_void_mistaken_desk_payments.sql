-- Desk payment void: mistaken “paid” flags must not lock the invoice as refunded.
-- Existing success rows stay in the ledger with status voided (amount stays positive).

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'payment_records'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    AND pg_get_constraintdef(c.oid) ILIKE '%refunded%'
    AND pg_get_constraintdef(c.oid) NOT ILIKE '%voided%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payment_records DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE payment_records DROP CONSTRAINT IF EXISTS payment_records_status_check;
ALTER TABLE payment_records
  ADD CONSTRAINT payment_records_status_check CHECK (
    status IN ('pending', 'success', 'failed', 'refunded', 'voided')
  );
