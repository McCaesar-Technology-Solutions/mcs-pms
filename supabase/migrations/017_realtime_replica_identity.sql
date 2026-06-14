-- Improve Realtime UPDATE payloads (old + new row values) for status transitions.

ALTER TABLE complaints REPLICA IDENTITY FULL;
ALTER TABLE complaint_estimates REPLICA IDENTITY FULL;
ALTER TABLE housekeeping_tasks REPLICA IDENTITY FULL;
