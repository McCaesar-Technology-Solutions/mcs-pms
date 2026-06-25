-- Apply after 040. Safe to run alone in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'billing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'growth', 'enterprise')),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  current_period_end timestamptz,
  max_properties integer NOT NULL DEFAULT 2,
  max_rooms_per_property integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_step text DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_hotels_organization ON hotels (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members (user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_own_organization" ON organizations;
CREATE POLICY "owner_read_own_organization" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_update_own_organization" ON organizations;
CREATE POLICY "owner_update_own_organization" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "owner_read_org_members" ON organization_members;
CREATE POLICY "owner_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_read_subscription" ON subscriptions;
CREATE POLICY "owner_read_subscription" ON subscriptions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

UPDATE profiles p
SET
  onboarding_step = 'done',
  onboarding_completed_at = COALESCE(p.onboarding_completed_at, now())
WHERE p.role = 'owner'
  AND p.onboarding_completed_at IS NULL
  AND EXISTS (SELECT 1 FROM hotels h WHERE h.owner_id = p.id OR h.id = p.hotel_id);
