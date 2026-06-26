-- Housekeeping flow: track who started/completed and when
ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_open
  ON housekeeping_tasks (hotel_id, status)
  WHERE status <> 'done';
