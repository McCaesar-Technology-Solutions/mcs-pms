-- Drop authenticator (TOTP) MFA — SMS is the only supported 2FA method.
-- Users with TOTP + a phone on file are switched to SMS; others are turned off.

UPDATE profiles
SET
  mfa_enabled = CASE
    WHEN mfa_method = 'totp' AND phone IS NOT NULL AND btrim(phone) <> '' THEN true
    WHEN mfa_method = 'totp' THEN false
    ELSE mfa_enabled
  END,
  mfa_method = CASE
    WHEN mfa_method = 'totp' AND phone IS NOT NULL AND btrim(phone) <> '' THEN 'sms'
    WHEN mfa_method = 'totp' THEN NULL
    ELSE mfa_method
  END,
  mfa_sms_enabled = CASE
    WHEN mfa_method = 'totp' AND phone IS NOT NULL AND btrim(phone) <> '' THEN true
    WHEN mfa_method = 'totp' THEN false
    ELSE mfa_sms_enabled
  END,
  mfa_totp_secret = NULL,
  mfa_totp_pending_secret = NULL
WHERE
  mfa_method = 'totp'
  OR mfa_totp_secret IS NOT NULL
  OR mfa_totp_pending_secret IS NOT NULL;
