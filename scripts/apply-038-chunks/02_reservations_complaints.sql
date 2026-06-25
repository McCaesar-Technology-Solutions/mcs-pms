-- Chunk 2/4

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (
  status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')
);

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_complaints_sla_due
  ON complaints (hotel_id, sla_due_at)
  WHERE status NOT IN ('resolved', 'rejected') AND sla_due_at IS NOT NULL;
