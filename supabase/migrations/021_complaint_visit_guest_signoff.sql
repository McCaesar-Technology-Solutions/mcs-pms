-- Guest visit scheduling and guest completion sign-off.

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS scheduled_visit_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_visit_by text
    CHECK (scheduled_visit_by IS NULL OR scheduled_visit_by IN ('guest', 'manager', 'owner')),
  ADD COLUMN IF NOT EXISTS guest_completion_approved_at timestamptz;

ALTER TABLE complaint_events DROP CONSTRAINT IF EXISTS complaint_events_event_type_check;

ALTER TABLE complaint_events ADD CONSTRAINT complaint_events_event_type_check
  CHECK (event_type IN (
    'submitted', 'assigned', 'started', 'completion_requested',
    'rejected', 'resolved', 'estimate_submitted', 'estimate_approved',
    'visit_scheduled', 'guest_completion_approved'
  ));
