-- OTA / iCal channel sync: import external calendars and export availability feeds.

CREATE TABLE channel_ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('airbnb', 'booking_com', 'other')),
  direction text NOT NULL CHECK (direction IN ('import', 'export')),
  import_url text,
  export_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('ok', 'error', 'pending')),
  last_sync_message text,
  events_synced integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_ical_feeds_import_url_check CHECK (
    direction <> 'import' OR (import_url IS NOT NULL AND length(trim(import_url)) > 0)
  )
);

CREATE UNIQUE INDEX idx_channel_ical_feeds_export_token ON channel_ical_feeds (export_token);
CREATE INDEX idx_channel_ical_feeds_hotel ON channel_ical_feeds (hotel_id);
CREATE INDEX idx_channel_ical_feeds_import_active ON channel_ical_feeds (direction, is_active)
  WHERE direction = 'import' AND is_active = true;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS ical_uid text,
  ADD COLUMN IF NOT EXISTS ical_feed_id uuid REFERENCES channel_ical_feeds(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_reservations_ical_uid_feed
  ON reservations (ical_feed_id, ical_uid)
  WHERE ical_uid IS NOT NULL;

ALTER TABLE channel_ical_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_channel_ical_feeds" ON channel_ical_feeds
  FOR ALL USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY "manager_read_channel_ical_feeds" ON channel_ical_feeds
  FOR SELECT USING (
    auth_role() IN ('manager', 'owner')
    AND hotel_id = auth_hotel_id()
  );

COMMENT ON TABLE channel_ical_feeds IS 'iCal import/export feeds for OTA calendar sync (Airbnb, Booking.com, etc.)';
