-- Harden channel iCal feeds for production Airbnb sync.

ALTER TABLE channel_ical_feeds
  ADD COLUMN IF NOT EXISTS last_http_etag text,
  ADD COLUMN IF NOT EXISTS last_content_hash text,
  ADD COLUMN IF NOT EXISTS sync_lock_until timestamptz;

COMMENT ON COLUMN channel_ical_feeds.last_http_etag IS 'ETag from last successful import fetch (conditional GET).';
COMMENT ON COLUMN channel_ical_feeds.last_content_hash IS 'SHA-256 of last imported ICS body.';
COMMENT ON COLUMN channel_ical_feeds.sync_lock_until IS 'Advisory lock expiry to prevent concurrent sync of the same feed.';

-- One active import feed per room + provider (Airbnb listing ↔ unit).
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_ical_feeds_unique_import_room_provider
  ON channel_ical_feeds (hotel_id, room_id, provider)
  WHERE direction = 'import' AND is_active = true AND room_id IS NOT NULL;

-- Import feeds must target a room (unit-level Airbnb calendars).
ALTER TABLE channel_ical_feeds
  DROP CONSTRAINT IF EXISTS channel_ical_feeds_import_room_check;

ALTER TABLE channel_ical_feeds
  ADD CONSTRAINT channel_ical_feeds_import_room_check CHECK (
    direction <> 'import' OR room_id IS NOT NULL
  );
