-- Optional 2FA: user-enabled with SMS or authenticator app (TOTP).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_method text
    CHECK (mfa_method IS NULL OR mfa_method IN ('sms', 'totp')),
  ADD COLUMN IF NOT EXISTS mfa_totp_secret text,
  ADD COLUMN IF NOT EXISTS mfa_totp_pending_secret text;

COMMENT ON COLUMN profiles.mfa_enabled IS
  'When true, staff must complete 2FA at sign-in using mfa_method.';
COMMENT ON COLUMN profiles.mfa_method IS
  'Active second factor: sms (OTP text) or totp (authenticator app).';
COMMENT ON COLUMN profiles.mfa_totp_secret IS
  'AES-GCM encrypted TOTP secret; only set when mfa_method = totp.';

-- Preserve prior SMS opt-ins from mfa_sms_enabled.
UPDATE profiles
SET
  mfa_enabled = true,
  mfa_method = 'sms'
WHERE COALESCE(mfa_sms_enabled, false) = true
  AND (mfa_method IS NULL OR mfa_enabled = false);

COMMENT ON COLUMN profiles.mfa_sms_enabled IS
  'Deprecated — use mfa_enabled and mfa_method.';
