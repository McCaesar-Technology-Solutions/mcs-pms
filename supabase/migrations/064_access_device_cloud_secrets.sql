-- Optional cloud-stored Hikvision controller credentials (encrypted at rest).
-- Alternative to keeping passwords only in the on-site agent .env.

ALTER TABLE access_integrations
  ADD COLUMN IF NOT EXISTS device_credential_mode text NOT NULL DEFAULT 'cloud'
  CHECK (device_credential_mode IN ('local', 'cloud'));

COMMENT ON COLUMN access_integrations.device_credential_mode IS
  'local = agent DEVICES env holds controller passwords; cloud = agent downloads encrypted credentials from MOJO (recommended).';

-- Connection fields for owner-managed devices (no password here).
ALTER TABLE access_devices
  ADD COLUMN IF NOT EXISTS host text,
  ADD COLUMN IF NOT EXISTS port int DEFAULT 80,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS use_https boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS managed_in_cloud boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN access_devices.managed_in_cloud IS
  'True when owner configured this controller in MOJO (cloud credential mode).';

-- Passwords: service role only — never expose via authenticated RLS.
CREATE TABLE IF NOT EXISTS access_device_secrets (
  device_id uuid PRIMARY KEY REFERENCES access_devices(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  password_encrypted text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_device_secrets_hotel
  ON access_device_secrets (hotel_id);

ALTER TABLE access_device_secrets ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies for anon/authenticated. Reads/writes use service role only.
DROP POLICY IF EXISTS access_device_secrets_deny_all ON access_device_secrets;

COMMENT ON TABLE access_device_secrets IS
  'Encrypted Hikvision controller passwords. Service role only; never returned to browser clients.';
