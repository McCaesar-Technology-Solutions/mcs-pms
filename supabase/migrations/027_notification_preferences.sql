-- Per-property SMS notification toggles (JSON map of template_key → enabled).

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS notification_sms_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN hotels.notification_sms_prefs IS
  'SMS event toggles; missing keys default to enabled. See lib/notifications/preferences.ts.';
