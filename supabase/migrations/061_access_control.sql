-- Hikvision physical access control (Mojo on-site agent + cloud job queue).
-- Device admin passwords stay on the property agent — never stored in this DB.

-- ---------------------------------------------------------------------------
-- Hotel feature flag
-- ---------------------------------------------------------------------------
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS access_control_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN hotels.access_control_enabled IS
  'When true, stay lifecycle enqueues Hikvision provision/revoke jobs for the on-site agent.';

-- ---------------------------------------------------------------------------
-- Audit entity
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (
  entity_type IN (
    'reservation',
    'room',
    'room_category',
    'hotel',
    'staff',
    'guest',
    'invoice',
    'complaint',
    'guest_request',
    'payment',
    'access'
  )
);

-- ---------------------------------------------------------------------------
-- Integration (one row per hotel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'hikvision' CHECK (provider IN ('hikvision')),
  enabled boolean NOT NULL DEFAULT false,
  agent_token_hash text,
  agent_token_prefix text,
  agent_last_seen_at timestamptz,
  agent_version text,
  agent_hostname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_integrations_hotel_unique UNIQUE (hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_access_integrations_hotel
  ON access_integrations (hotel_id);

ALTER TABLE access_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_integrations_staff_select ON access_integrations;
CREATE POLICY access_integrations_staff_select ON access_integrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_integrations.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
        AND p.is_active IS TRUE
    )
  );

COMMENT ON COLUMN access_integrations.agent_token_hash IS
  'SHA-256 hex of agent bearer token. Plaintext shown once at rotation; never stored.';

-- ---------------------------------------------------------------------------
-- Devices registered by the on-site agent (metadata only — no passwords)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  device_key text NOT NULL,
  label text NOT NULL,
  model text,
  serial_number text,
  firmware text,
  last_seen_at timestamptz,
  is_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_devices_hotel_key_unique UNIQUE (hotel_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_access_devices_hotel
  ON access_devices (hotel_id);

ALTER TABLE access_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_devices_staff_select ON access_devices;
CREATE POLICY access_devices_staff_select ON access_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_devices.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
        AND p.is_active IS TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- Doors / readers mapped to rooms or shared zones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  device_key text NOT NULL,
  door_no int NOT NULL DEFAULT 1 CHECK (door_no >= 1 AND door_no <= 64),
  label text NOT NULL,
  zone text NOT NULL DEFAULT 'unit' CHECK (zone IN ('unit', 'lobby', 'gate', 'elevator', 'other')),
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  grants_shared_access boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_points_device_door_unique UNIQUE (hotel_id, device_key, door_no)
);

CREATE INDEX IF NOT EXISTS idx_access_points_hotel
  ON access_points (hotel_id, is_active);

CREATE INDEX IF NOT EXISTS idx_access_points_room
  ON access_points (hotel_id, room_id)
  WHERE room_id IS NOT NULL;

ALTER TABLE access_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_points_staff_select ON access_points;
CREATE POLICY access_points_staff_select ON access_points
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_points.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
        AND p.is_active IS TRUE
    )
  );

COMMENT ON COLUMN access_points.grants_shared_access IS
  'When true, every provisioned in-house guest receives this door (lobby/gate).';

-- ---------------------------------------------------------------------------
-- Guest / staff credentials mirrored to Hikvision persons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  employee_no text NOT NULL,
  display_name text NOT NULL,
  card_no text,
  has_pin boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'revoking', 'revoked', 'error')
  ),
  sync_status text NOT NULL DEFAULT 'pending' CHECK (
    sync_status IN ('pending', 'synced', 'failed')
  ),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_credentials_hotel_employee_unique UNIQUE (hotel_id, employee_no)
);

CREATE INDEX IF NOT EXISTS idx_access_credentials_hotel_status
  ON access_credentials (hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_access_credentials_guest
  ON access_credentials (guest_id)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_credentials_reservation
  ON access_credentials (reservation_id)
  WHERE reservation_id IS NOT NULL;

ALTER TABLE access_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_credentials_staff_select ON access_credentials;
CREATE POLICY access_credentials_staff_select ON access_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_credentials.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
        AND p.is_active IS TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- Job queue for the on-site agent (cloud never calls device ISAPI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  credential_id uuid REFERENCES access_credentials(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (
    job_type IN ('provision', 'revoke', 'update_validity', 'assign_card', 'unlock', 'sync_device')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'claimed', 'succeeded', 'failed', 'dead', 'cancelled')
  ),
  priority int NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  idempotency_key text,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 8,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_jobs_idempotency
  ON access_jobs (hotel_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_jobs_poll
  ON access_jobs (hotel_id, status, next_retry_at, priority, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_access_jobs_claimed
  ON access_jobs (status, claimed_at)
  WHERE status = 'claimed';

ALTER TABLE access_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_jobs_staff_select ON access_jobs;
CREATE POLICY access_jobs_staff_select ON access_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_jobs.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
        AND p.is_active IS TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- Access events (swipe / unlock) reported by agent — ops audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  device_key text,
  door_no int,
  employee_no text,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  raw jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_events_hotel_occurred
  ON access_events (hotel_id, occurred_at DESC);

ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_events_staff_select ON access_events;
CREATE POLICY access_events_staff_select ON access_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = access_events.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
        AND p.is_active IS TRUE
    )
  );
