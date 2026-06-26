import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

function organizationSlug(ownerId: string, label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'portfolio'}-${ownerId.replace(/-/g, '').slice(0, 8)}`
}

/** Ensure a SaaS organization, membership, and trial subscription exist for a new owner. */
export async function ensureOwnerOrganization(
  admin: AdminClient,
  ownerId: string,
  ownerName: string,
  hotelName: string,
  hotelId: string,
): Promise<string> {
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, name')
    .eq('id', ownerId)
    .maybeSingle()

  if (profile?.organization_id) {
    await admin
      .from('hotels')
      .update({ organization_id: profile.organization_id })
      .eq('id', hotelId)
      .is('organization_id', null)
    return profile.organization_id
  }

  const displayName = hotelName.trim() || `${ownerName.trim() || 'Owner'} Portfolio`
  const slug = organizationSlug(ownerId, displayName)

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: displayName, slug })
    .select('id')
    .single()

  if (orgError || !org) {
    throw new Error(orgError?.message ?? 'Could not create organization.')
  }

  const orgId = org.id

  const { error: profileError } = await admin
    .from('profiles')
    .update({ organization_id: orgId })
    .eq('id', ownerId)

  if (profileError) throw new Error(profileError.message)

  await admin.from('hotels').update({ organization_id: orgId }).eq('id', hotelId)

  const { error: memberError } = await admin.from('organization_members').insert({
    organization_id: orgId,
    user_id: ownerId,
    role: 'owner',
  })

  if (memberError && !memberError.message.includes('duplicate')) {
    throw new Error(memberError.message)
  }

  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const { error: subError } = await admin.from('subscriptions').insert({
    organization_id: orgId,
    plan: 'trial',
    status: 'trialing',
    trial_ends_at: trialEnds,
    max_properties: 2,
    max_rooms_per_property: 30,
  })

  if (subError && !subError.message.includes('duplicate')) {
    throw new Error(subError.message)
  }

  return orgId
}
