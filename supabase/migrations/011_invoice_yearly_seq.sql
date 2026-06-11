-- Reset invoice sequence to 00001 each calendar year (GRA-friendly numbering)

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS invoice_seq_year int;

CREATE OR REPLACE FUNCTION allocate_invoice_number(p_hotel_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_seq int;
  v_year int;
  v_stored_year int;
  v_number text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;

  SELECT
    COALESCE(invoice_prefix, 'MOJO'),
    COALESCE(invoice_next_seq, 1),
    invoice_seq_year
  INTO v_prefix, v_seq, v_stored_year
  FROM hotels
  WHERE id = p_hotel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hotel not found: %', p_hotel_id;
  END IF;

  IF v_stored_year IS NULL OR v_stored_year <> v_year THEN
    v_seq := 1;
  END IF;

  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_seq::text, 5, '0');

  UPDATE hotels
  SET invoice_next_seq = v_seq + 1,
      invoice_seq_year = v_year
  WHERE id = p_hotel_id;

  RETURN v_number;
END;
$$;
