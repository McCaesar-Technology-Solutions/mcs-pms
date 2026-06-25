-- Billing loop: partial payments and folio reconciliation

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check CHECK (
  payment_status IN ('pending', 'partial', 'paid', 'overdue', 'refunded')
);

UPDATE invoices
SET amount_paid = COALESCE(total_amount, 0)
WHERE payment_status = 'paid' AND amount_paid = 0;

COMMENT ON COLUMN invoices.amount_paid IS 'Cumulative payments recorded against this invoice (manual, Paystack, partial).';
