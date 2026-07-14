-- Security hardening: RPC lockdown, portal PIN hashing, MFA pending phone, conversation insert policy.

-- Invoice numbering RPC must not be callable by authenticated clients (service role only).
REVOKE ALL ON FUNCTION allocate_invoice_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION allocate_invoice_number(uuid) TO service_role;

-- Store hashed portal PINs instead of plaintext (legacy portal_pin column retained for migration).
ALTER TABLE guests ADD COLUMN IF NOT EXISTS portal_pin_hash text;

COMMENT ON COLUMN guests.portal_pin_hash IS
  'HMAC hash of the guest portal PIN; plaintext portal_pin is deprecated and cleared after backfill.';

-- Pending phone for MFA enrollment — commit to profiles.phone only after OTP verification.
ALTER TABLE mfa_otp_challenges ADD COLUMN IF NOT EXISTS pending_phone text;

COMMENT ON COLUMN mfa_otp_challenges.pending_phone IS
  'Phone number awaiting OTP verification before persisting to profiles.phone.';

-- Route staff conversation creation through server actions only.
DROP POLICY IF EXISTS staff_conv_insert ON staff_conversations;
