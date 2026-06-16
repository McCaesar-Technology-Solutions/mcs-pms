-- Visit times are set by the technician after agreeing with the guest.

ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_scheduled_visit_by_check;

ALTER TABLE complaints ADD CONSTRAINT complaints_scheduled_visit_by_check
  CHECK (
    scheduled_visit_by IS NULL
    OR scheduled_visit_by IN ('guest', 'manager', 'owner', 'technician')
  );
