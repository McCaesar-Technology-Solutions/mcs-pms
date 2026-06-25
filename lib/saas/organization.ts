import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CATALOG, daysUntil, type SaasPlan, type SubscriptionSnapshot } from '@/lib/saas/plans'

export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'portfolio'
}

async function uniqueSlug(base: string): Promise<string> {
  const admin = createAdminClient()
  let slug = base
  let attempt = 0

  while (attempt < 20) {
    const { data } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    attempt++
    slug = `${base}-${Math.random().toString(36).slice(2, 8)}`
  }

  return `${base}-${Date.now().toString(36)}`
}

export async function createOrganizationForOwner(
  ownerId: string,
  organizationName: string,
): Promise<{ organizationId: string; slug: string } | null> {
  const admin = createAdminClient()
  const slug = await uniqueSlug(slugifyOrganizationName(organizationName))

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: organizationName.trim(), slug })
    .select('id, slug')
    .single()

  if (orgError || !org) return null

  const trial = PLAN_CATALOG.trial
  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + trial.trialDays)

  const { error: memberError } = await admin.from('organization_members').insert({
    organization_id: org.id,
    user_id: ownerId,
    role: 'owner',
  })

  if (memberError) {
    await admin.from('organizations').delete().eq('id', org.id)
    return null
  }

  const { error: subError } = await admin.from('subscriptions').insert({
    organization_id: org.id,
    plan: 'trial' satisfies SaasPlan,
    status: 'trialing',
    trial_ends_at: trialEnds.toISOString(),
    max_properties: trial.maxProperties,
    max_rooms_per_property: trial.maxRoomsPerProperty,
  })

  if (subError) {
    await admin.from('organization_members').delete().eq('organization_id', org.id)
    await admin.from('organizations').delete().eq('id', org.id)
    return null
  }

  return { organizationId: org.id, slug: org.slug }
}

export async function getSubscriptionForOwner(ownerId: string): Promise<SubscriptionSnapshot | null> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', ownerId)
    .maybeSingle()

  if (!profile?.organization_id) return null

  const [{ data: org }, { data: sub }] = await Promise.all([
    admin.from('organizations').select('id, name').eq('id', profile.organization_id).maybeSingle(),
    admin
      .from('subscriptions')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .maybeSingle(),
  ])

  if (!org || !sub) return null

  const plan = sub.plan as SaasPlan
  const daysLeft = sub.status === 'trialing' ? daysUntil(sub.trial_ends_at) : null

  return {
    organizationId: org.id,
    organizationName: org.name,
    plan,
    status: sub.status,
    trialEndsAt: sub.trial_ends_at,
    maxProperties: sub.max_properties,
    maxRoomsPerProperty: sub.max_rooms_per_property,
    daysLeftInTrial: daysLeft,
    isTrialExpired: sub.status === 'trialing' && daysLeft != null && daysLeft <= 0,
  }
}

export async function countOrganizationProperties(organizationId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('hotels')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
  return count ?? 0
}
