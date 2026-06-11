-- Sequential invoice numbers per hotel (e.g. MOJO-2026-00001)

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'MOJO',
  ADD COLUMN IF NOT EXISTS invoice_next_seq int NOT NULL DEFAULT 1;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number text;

-- Backfill existing invoices
DO $$
DECLARE
  h record;
  inv record;
  yr int;
  seq int;
BEGIN
  FOR h IN SELECT id, COALESCE(invoice_prefix, 'MOJO') AS prefix FROM hotels LOOP
    seq := 0;
    FOR inv IN
      SELECT id, issued_at
      FROM invoices
      WHERE hotel_id = h.id AND invoice_number IS NULL
      ORDER BY COALESCE(issued_at, now()), id
    LOOP
      yr := EXTRACT(YEAR FROM COALESCE(inv.issued_at, now()))::int;
      seq := seq + 1;
      UPDATE invoices
      SET invoice_number = h.prefix || '-' || yr || '-' || LPAD(seq::text, 5, '0')
      WHERE id = inv.id;
    END LOOP;

    IF seq > 0 THEN
      UPDATE hotels SET invoice_next_seq = seq + 1 WHERE id = h.id;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_hotel_number
  ON invoices (hotel_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

CREATE OR REPLACE FUNCTION allocate_invoice_number(p_hotel_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_seq int;
  v_year int;
  v_number text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;

  SELECT COALESCE(invoice_prefix, 'MOJO'), COALESCE(invoice_next_seq, 1)
  INTO v_prefix, v_seq
  FROM hotels
  WHERE id = p_hotel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hotel not found: %', p_hotel_id;
  END IF;

  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_seq::text, 5, '0');

  UPDATE hotels SET invoice_next_seq = v_seq + 1 WHERE id = p_hotel_id;

  RETURN v_number;
END;
$$;
