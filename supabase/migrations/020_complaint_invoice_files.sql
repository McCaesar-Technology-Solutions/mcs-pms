-- Optional uploaded invoice files (PDF / image) on technician cost estimates.

ALTER TABLE complaint_estimates
  ADD COLUMN IF NOT EXISTS invoice_file_path text,
  ADD COLUMN IF NOT EXISTS invoice_file_name text,
  ADD COLUMN IF NOT EXISTS invoice_file_mime text;

COMMENT ON COLUMN complaint_estimates.invoice_file_path IS
  'Supabase Storage object path in complaint-invoices bucket.';
COMMENT ON COLUMN complaint_estimates.invoice_file_name IS
  'Original filename shown to staff when downloading.';
COMMENT ON COLUMN complaint_estimates.invoice_file_mime IS
  'MIME type of the uploaded invoice file.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-invoices',
  'complaint-invoices',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
