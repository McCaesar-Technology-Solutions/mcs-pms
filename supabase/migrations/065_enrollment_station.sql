-- Enrollment station (DS-K1F600U-D6E-F) + capture job types.

ALTER TABLE access_devices
  ADD COLUMN IF NOT EXISTS device_role text NOT NULL DEFAULT 'door';

ALTER TABLE access_devices
  DROP CONSTRAINT IF EXISTS access_devices_device_role_check;

ALTER TABLE access_devices
  ADD CONSTRAINT access_devices_device_role_check
  CHECK (device_role IN ('door', 'enrollment'));

COMMENT ON COLUMN access_devices.device_role IS
  'door = access controller/terminal; enrollment = DS-K1F600U-D6E-F (or similar) capture station';

ALTER TABLE access_credentials
  ADD COLUMN IF NOT EXISTS has_face boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_fingerprint boolean NOT NULL DEFAULT false;

-- Expand job_type check for enroll capture jobs.
ALTER TABLE access_jobs DROP CONSTRAINT IF EXISTS access_jobs_job_type_check;
ALTER TABLE access_jobs
  ADD CONSTRAINT access_jobs_job_type_check CHECK (
    job_type IN (
      'provision',
      'revoke',
      'update_validity',
      'assign_card',
      'unlock',
      'sync_device',
      'enroll_card_capture',
      'enroll_face_capture',
      'enroll_fingerprint_capture'
    )
  );
