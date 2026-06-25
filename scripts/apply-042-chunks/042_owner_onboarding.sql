-- Owner onboarding columns only (no org/subscription tables). Apply if 041 was skipped.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE profiles p
SET
  onboarding_step = 'done',
  onboarding_completed_at = COALESCE(p.onboarding_completed_at, now())
WHERE p.role = 'owner'
  AND p.onboarding_completed_at IS NULL
  AND p.hotel_id IS NOT NULL;
