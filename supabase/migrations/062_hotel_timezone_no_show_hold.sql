-- Property timezone for cron/day-boundary logic; no-show room hold through release.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Accra';

COMMENT ON COLUMN hotels.timezone IS 'IANA timezone for no-show, checkout, and overstay cron timing.';

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS room_held_until date;

COMMENT ON COLUMN reservations.room_held_until IS 'When set on a no-show, the room stays blocked until staff releases it or this date passes.';

CREATE INDEX IF NOT EXISTS idx_reservations_no_show_room_hold
  ON reservations (hotel_id, room_id)
  WHERE status = 'no_show' AND room_held_until IS NOT NULL;
