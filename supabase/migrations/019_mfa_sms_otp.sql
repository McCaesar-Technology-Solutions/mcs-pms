-- SMS one-time-code 2FA (replaces Supabase TOTP / authenticator app flow).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mfa_sms_enabled boolean DEFAULT false;

COMMENT ON COLUMN profiles.mfa_sms_enabled IS
  'When true, receptionist/technician must verify via SMS at login. Owner/manager always require SMS MFA.';

CREATE TABLE IF NOT EXISTS mfa_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfa_verified_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_mfa_otp_user_created ON mfa_otp_challenges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_lookup ON mfa_verified_sessions (user_id, session_key);

ALTER TABLE mfa_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_verified_sessions ENABLE ROW LEVEL SECURITY;

-- Server actions use the service role; no client policies.
