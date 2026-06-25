-- Guided owner setup (no SaaS billing). Safe if migration 041 was skipped.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text DEFAULT 'welcome'
    CHECK (onboarding_step IN ('welcome', 'property', 'compliance', 'team', 'done')),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE profiles p
SET
  onboarding_step = 'done',
  onboarding_completed_at = COALESCE(p.onboarding_completed_at, now())
WHERE p.role = 'owner'
  AND p.onboarding_completed_at IS NULL
  AND p.hotel_id IS NOT NULL;

COMMENT ON COLUMN profiles.onboarding_step IS 'Owner first-run wizard progress';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Set when owner finishes /get-started';
