-- Two-step complaint workflow: invoice approval → work → completion approval.

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS approval_stage text
    CHECK (approval_stage IS NULL OR approval_stage IN ('estimate', 'completion'));

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS estimate_approved_at timestamptz;

-- Existing pending_approval rows were completion requests under the old flow.
UPDATE complaints
SET approval_stage = 'completion'
WHERE status = 'pending_approval'
  AND approval_stage IS NULL;

ALTER TABLE complaint_events DROP CONSTRAINT IF EXISTS complaint_events_event_type_check;

ALTER TABLE complaint_events ADD CONSTRAINT complaint_events_event_type_check
  CHECK (event_type IN (
    'submitted', 'assigned', 'started', 'completion_requested',
    'rejected', 'resolved', 'estimate_submitted', 'estimate_approved'
  ));
