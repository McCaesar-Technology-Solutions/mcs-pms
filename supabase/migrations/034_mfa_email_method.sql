-- Email as a second-factor method alongside SMS (authenticator/TOTP removed).

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_mfa_method_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_mfa_method_check
  CHECK (mfa_method IS NULL OR mfa_method IN ('sms', 'email'));

COMMENT ON COLUMN profiles.mfa_method IS
  'Active second factor at sign-in: sms or email one-time code.';
