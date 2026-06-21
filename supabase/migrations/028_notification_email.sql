-- Email notifications for owners/managers (Resend) + log support.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS notification_email_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN hotels.notification_email_prefs IS
  'Email alert toggles for owner/manager; missing keys default to enabled. See lib/notifications/email-preferences.ts.';

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS recipient_email text;

ALTER TABLE notification_log
  ALTER COLUMN recipient_phone DROP NOT NULL;

ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_channel_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_channel_check
  CHECK (channel IN ('sms', 'whatsapp', 'email'));
