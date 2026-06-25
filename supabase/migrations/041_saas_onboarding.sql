-- SaaS onboarding: organizations, subscriptions, and owner setup state.

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'billing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE subscriptions (
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
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'welcome'
    CHECK (onboarding_step IN ('welcome', 'property', 'compliance', 'team', 'done')),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_hotels_organization ON hotels (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members (user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_own_organization" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "owner_update_own_organization" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "owner_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "owner_read_subscription" ON subscriptions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Existing owners with a hotel are treated as fully onboarded.
UPDATE profiles p
SET
  onboarding_step = 'done',
  onboarding_completed_at = COALESCE(p.onboarding_completed_at, now())
WHERE p.role = 'owner'
  AND p.onboarding_completed_at IS NULL
  AND EXISTS (SELECT 1 FROM hotels h WHERE h.owner_id = p.id OR h.id = p.hotel_id);

-- Backfill organizations for owners who already have hotels but no org row.
INSERT INTO organizations (id, name, slug)
SELECT
  gen_random_uuid(),
  COALESCE(h.name, p.name || ' Portfolio'),
  lower(regexp_replace(COALESCE(h.name, p.name, 'portfolio'), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(replace(p.id::text, '-', ''), 1, 8)
FROM profiles p
LEFT JOIN hotels h ON h.id = p.hotel_id OR h.owner_id = p.id
WHERE p.role = 'owner'
  AND p.organization_id IS NULL
ON CONFLICT DO NOTHING;

-- Link profiles and hotels (best-effort for legacy rows).
WITH owner_orgs AS (
  SELECT p.id AS user_id, o.id AS org_id
  FROM profiles p
  JOIN organizations o ON o.slug LIKE '%' || substr(replace(p.id::text, '-', ''), 1, 8)
  WHERE p.role = 'owner' AND p.organization_id IS NULL
)
UPDATE profiles p
SET organization_id = oo.org_id
FROM owner_orgs oo
WHERE p.id = oo.user_id AND p.organization_id IS NULL;

UPDATE hotels h
SET organization_id = p.organization_id
FROM profiles p
WHERE h.organization_id IS NULL
  AND p.organization_id IS NOT NULL
  AND (h.owner_id = p.id OR h.id = p.hotel_id);

INSERT INTO organization_members (organization_id, user_id, role)
SELECT p.organization_id, p.id, 'owner'
FROM profiles p
WHERE p.role = 'owner'
  AND p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = p.organization_id AND m.user_id = p.id
  );

INSERT INTO subscriptions (organization_id, plan, status, trial_ends_at, max_properties, max_rooms_per_property)
SELECT p.organization_id, 'trial', 'trialing', now() + interval '14 days', 2, 30
FROM profiles p
WHERE p.role = 'owner'
  AND p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.organization_id = p.organization_id
  );

COMMENT ON TABLE organizations IS 'SaaS tenant account — one per owner signup portfolio';
COMMENT ON TABLE subscriptions IS 'Plan and trial limits for an organization';
