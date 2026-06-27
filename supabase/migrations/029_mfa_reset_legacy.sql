UPDATE profiles
SET
  mfa_enabled = false,
  mfa_method = NULL,
  mfa_sms_enabled = false,
  mfa_totp_secret = NULL,
  mfa_totp_pending_secret = NULL
WHERE COALESCE(mfa_enabled, false) = true;

DELETE FROM mfa_verified_sessions;

COMMENT ON COLUMN profiles.mfa_enabled IS
  'Opt-in only: when true, user chose 2FA in Settings and must verify at sign-in.';
