-- Access persons, policies, gym zone, attendance foundation (SRS phases 1–5).
-- Payment-gated provision intentionally not included (deferred).

-- ---------------------------------------------------------------------------
-- Access point zones: add gym (amenity for in-house guests)
-- ---------------------------------------------------------------------------
ALTER TABLE access_points DROP CONSTRAINT IF EXISTS access_points_zone_check;
ALTER TABLE access_points
  ADD CONSTRAINT access_points_zone_check
  CHECK (zone IN ('unit', 'lobby', 'gate', 'elevator', 'gym', 'other'));

COMMENT ON COLUMN access_points.zone IS
  'unit = room door; lobby/gate/elevator = shared when grants_shared_access; gym = amenity for all in-house guests; other = custom.';

COMMENT ON COLUMN access_points.grants_shared_access IS
  'When true, every provisioned in-house guest receives this door (typically lobby/corridor). Gym uses zone=gym instead.';

-- ---------------------------------------------------------------------------
-- Device roles: attendance terminal
-- ---------------------------------------------------------------------------
ALTER TABLE access_devices DROP CONSTRAINT IF EXISTS access_devices_device_role_check;
ALTER TABLE access_devices
  ADD CONSTRAINT access_devices_device_role_check
  CHECK (device_role IN ('door', 'enrollment', 'attendance'));

COMMENT ON COLUMN access_devices.device_role IS
  'door = access terminal; enrollment = capture station; attendance = DS-K1A8503MF-B (staff only).';

-- ---------------------------------------------------------------------------
-- Access policies (internal door groups — not Hikvision IDs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  audience text NOT NULL DEFAULT 'staff'
    CHECK (audience IN ('staff', 'guest')),
  assignable_by_manager boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_policies_hotel_code_unique UNIQUE (hotel_id, code)
);

CREATE INDEX IF NOT EXISTS idx_access_policies_hotel
  ON access_policies (hotel_id, audience);

ALTER TABLE access_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_policies_staff_select ON access_policies;
CREATE POLICY access_policies_staff_select ON access_policies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_policies.hotel_id
        AND p.role IN ('owner', 'manager')
        AND p.is_active IS TRUE
    )
  );

CREATE TABLE IF NOT EXISTS access_policy_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES access_policies(id) ON DELETE CASCADE,
  access_point_id uuid NOT NULL REFERENCES access_points(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_policy_points_unique UNIQUE (policy_id, access_point_id)
);

CREATE INDEX IF NOT EXISTS idx_access_policy_points_hotel
  ON access_policy_points (hotel_id, policy_id);

ALTER TABLE access_policy_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_policy_points_staff_select ON access_policy_points;
CREATE POLICY access_policy_points_staff_select ON access_policy_points
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_policy_points.hotel_id
        AND p.role IN ('owner', 'manager')
        AND p.is_active IS TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- Credentials: person type + staff linkage + policy
-- ---------------------------------------------------------------------------
ALTER TABLE access_credentials
  ADD COLUMN IF NOT EXISTS person_type text NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_status text,
  ADD COLUMN IF NOT EXISTS access_policy_id uuid REFERENCES access_policies(id) ON DELETE SET NULL;

ALTER TABLE access_credentials DROP CONSTRAINT IF EXISTS access_credentials_person_type_check;
ALTER TABLE access_credentials
  ADD CONSTRAINT access_credentials_person_type_check
  CHECK (
    person_type IN (
      'tenant',
      'owner',
      'manager',
      'receptionist',
      'housekeeping',
      'security',
      'maintenance',
      'other_staff',
      'technical_admin'
    )
  );

ALTER TABLE access_credentials DROP CONSTRAINT IF EXISTS access_credentials_staff_status_check;
ALTER TABLE access_credentials
  ADD CONSTRAINT access_credentials_staff_status_check
  CHECK (
    staff_status IS NULL
    OR staff_status IN ('active', 'suspended', 'on_leave', 'terminated')
  );

UPDATE access_credentials
SET person_type = 'tenant'
WHERE guest_id IS NOT NULL AND (person_type IS NULL OR person_type = 'tenant');

CREATE INDEX IF NOT EXISTS idx_access_credentials_person_type
  ON access_credentials (hotel_id, person_type, status);

CREATE INDEX IF NOT EXISTS idx_access_credentials_profile
  ON access_credentials (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_credentials_policy
  ON access_credentials (access_policy_id)
  WHERE access_policy_id IS NOT NULL;

COMMENT ON COLUMN access_credentials.person_type IS
  'Physical access person category. Reception may only see/manage tenant.';

-- Reception: tenant credentials only. Owner/manager: all hotel credentials.
DROP POLICY IF EXISTS access_credentials_staff_select ON access_credentials;
CREATE POLICY access_credentials_staff_select ON access_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_credentials.hotel_id
        AND p.is_active IS TRUE
        AND (
          p.role IN ('owner', 'manager')
          OR (
            p.role = 'receptionist'
            AND access_credentials.person_type = 'tenant'
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Attendance records (staff only — populated by agent / ingest)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  credential_id uuid REFERENCES access_credentials(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  employee_no text NOT NULL,
  display_name text,
  event_type text NOT NULL DEFAULT 'unknown'
    CHECK (event_type IN ('clock_in', 'clock_out', 'unknown')),
  occurred_at timestamptz NOT NULL,
  device_key text,
  raw_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_hotel_time
  ON attendance_records (hotel_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee
  ON attendance_records (hotel_id, employee_no, occurred_at DESC);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_records_staff_select ON attendance_records;
CREATE POLICY attendance_records_staff_select ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = attendance_records.hotel_id
        AND p.role IN ('owner', 'manager')
        AND p.is_active IS TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- Job type: pull attendance from device
-- ---------------------------------------------------------------------------
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
      'enroll_fingerprint_capture',
      'pull_attendance'
    )
  );
