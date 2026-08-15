-- Guest identity document: Ghana Card, passport, or driver's licence.
-- Invoice GRA Tax ID stays the hotel stamp (resolveInvoiceTaxId); this is the guest record only.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS id_document_type text,
  ADD COLUMN IF NOT EXISTS id_document_number text,
  ADD COLUMN IF NOT EXISTS id_document_country text;

ALTER TABLE guests
  DROP CONSTRAINT IF EXISTS guests_id_document_type_check;

ALTER TABLE guests
  ADD CONSTRAINT guests_id_document_type_check
  CHECK (
    id_document_type IS NULL
    OR id_document_type IN ('ghana_card', 'passport', 'drivers_license')
  );

COMMENT ON COLUMN guests.id_document_type IS
  'ghana_card | passport | drivers_license. Null means no ID on file.';
COMMENT ON COLUMN guests.id_document_number IS
  'Normalized ID number for the selected type.';
COMMENT ON COLUMN guests.id_document_country IS
  'ISO 3166-1 alpha-2 issuing country. Ghana Card defaults to GH.';

UPDATE guests
SET
  id_document_type = 'ghana_card',
  id_document_number = ghana_card_number,
  id_document_country = 'GH'
WHERE ghana_card_number IS NOT NULL
  AND btrim(ghana_card_number) <> ''
  AND id_document_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_guests_hotel_id_document_number
  ON guests (hotel_id, id_document_number)
  WHERE id_document_number IS NOT NULL;
