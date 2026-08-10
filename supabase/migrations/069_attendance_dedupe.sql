-- Phase F: re-pull must not duplicate attendance punches.
-- NULLS NOT DISTINCT so missing device_key still dedupes (PG15+).

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_natural
  ON attendance_records (hotel_id, employee_no, occurred_at, event_type, device_key)
  NULLS NOT DISTINCT;

COMMENT ON INDEX idx_attendance_records_natural IS
  'Natural key for attendance ingest upsert — hotel + employee + time + type + device';
