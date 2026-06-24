-- Per-property outbound email address (Resend "from" — must be on a verified domain).

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS notification_from_email text;

COMMENT ON COLUMN hotels.notification_from_email IS
  'Sender email for operational alerts; display name uses property name. Falls back to RESEND_FROM env.';
