'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/log'
import {
  bumpGuestRulesVersion,
  getGuestRulesBySlug,
  getHotelGuestRules,
  type GuestRuleRow,
} from '@/lib/data/guest-rules'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { setPropertyRulesAck } from '@/lib/guest-rules-cookie'
import { isValidGuestPortalSlug } from '@/lib/guest-portal'

export type GuestRulesActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireRulesEditor(hotelId: string) {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager'] })
  if (!result.ok) return { ok: false as const, error: consumeStaffAuthError(result.error) }

  const { profile, userId } = result

  if (profile.role === 'owner') {
    const owns = await ownerOwnsHotel(userId, hotelId)
    if (!owns) return { ok: false as const, error: 'Not authorized for this property.' }
    return { ok: true as const, userId, actorName: profile.name }
  }

  if (profile.hotel_id === hotelId) {
    return { ok: true as const, userId, actorName: profile.name }
  }

  return { ok: false as const, error: 'Only owners and managers can edit guest rules.' }
}

function revalidateGuestRulesViews() {
  revalidatePath('/owner/settings')
  revalidatePath('/manager/dashboard')
  revalidatePath('/guest/join/[slug]', 'page')
  revalidatePath('/guest')
}

export async function fetchStaffGuestRules(
  hotelId: string,
): Promise<GuestRulesActionResult<{ version: number; rules: GuestRuleRow[] }>> {
  const auth = await requireRulesEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const bundle = await getHotelGuestRules(hotelId)
  if (!bundle) return { success: false, error: 'Property not found.' }

  return {
    success: true,
    data: { version: bundle.version, rules: bundle.rules },
  }
}

export async function addGuestRule(
  hotelId: string,
  ruleText: string,
): Promise<GuestRulesActionResult> {
  const trimmed = ruleText.trim()
  if (trimmed.length < 5) {
    return { success: false, error: 'Enter a rule of at least 5 characters.' }
  }

  const auth = await requireRulesEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: latest } = await admin
    .from('hotel_guest_rules')
    .select('sort_order')
    .eq('hotel_id', hotelId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (latest?.sort_order ?? -1) + 1
  const { error } = await admin.from('hotel_guest_rules').insert({
    hotel_id: hotelId,
    rule_text: trimmed,
    sort_order: sortOrder,
  })

  if (error) return { success: false, error: 'Could not add the rule.' }

  await bumpGuestRulesVersion(hotelId)

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.actorName,
    entityType: 'hotel',
    entityId: hotelId,
    action: 'guest_rules_updated',
    summary: `Guest rules: added "${trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed}"`,
    details: { change: 'added', ruleText: trimmed },
  })

  revalidateGuestRulesViews()
  return { success: true }
}

export async function removeGuestRule(
  hotelId: string,
  ruleId: string,
): Promise<GuestRulesActionResult> {
  const auth = await requireRulesEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: rule } = await admin
    .from('hotel_guest_rules')
    .select('id, rule_text')
    .eq('id', ruleId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!rule) return { success: false, error: 'Rule not found.' }

  const { count } = await admin
    .from('hotel_guest_rules')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  if ((count ?? 0) <= 1) {
    return { success: false, error: 'At least one rule must remain for guests.' }
  }

  const { error } = await admin.from('hotel_guest_rules').delete().eq('id', ruleId)
  if (error) return { success: false, error: 'Could not remove the rule.' }

  await bumpGuestRulesVersion(hotelId)

  const text = rule.rule_text.trim()
  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.actorName,
    entityType: 'hotel',
    entityId: hotelId,
    action: 'guest_rules_updated',
    summary: `Guest rules: removed "${text.length > 60 ? `${text.slice(0, 57)}…` : text}"`,
    details: { change: 'removed', ruleText: text },
  })

  revalidateGuestRulesViews()
  return { success: true }
}

/** QR join flow — guest agrees before entering a room number. */
export async function acceptPropertyRulesBySlug(slug: string): Promise<GuestRulesActionResult> {
  const normalized = slug.trim().toLowerCase()
  if (!isValidGuestPortalSlug(normalized)) {
    return { success: false, error: 'Invalid property link.' }
  }

  const bundle = await getGuestRulesBySlug(normalized)
  if (!bundle) return { success: false, error: 'Property not found.' }

  await setPropertyRulesAck(bundle.hotelId, bundle.version)
  return { success: true }
}

/** Portal gate — record acceptance on the guest stay. */
export async function acceptGuestRulesForSession(): Promise<GuestRulesActionResult> {
  const { getGuestSessionId } = await import('@/lib/guest-session')
  const guestId = await getGuestSessionId()
  if (!guestId) return { success: false, error: 'No active guest session.' }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('id, hotel_id')
    .eq('id', guestId)
    .maybeSingle()

  if (!guest?.hotel_id) return { success: false, error: 'Guest session invalid.' }

  const bundle = await getHotelGuestRules(guest.hotel_id)
  if (!bundle) return { success: false, error: 'Property not found.' }

  const { error } = await admin
    .from('guests')
    .update({ guest_rules_accepted_version: bundle.version })
    .eq('id', guestId)

  if (error) return { success: false, error: 'Could not save your acceptance.' }

  await setPropertyRulesAck(bundle.hotelId, bundle.version)
  revalidatePath('/guest')
  return { success: true }
}

export async function guestNeedsRulesAcceptance(guestId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('hotel_id, guest_rules_accepted_version')
    .eq('id', guestId)
    .maybeSingle()

  if (!guest?.hotel_id) return false

  const { data: hotel } = await admin
    .from('hotels')
    .select('guest_rules_version')
    .eq('id', guest.hotel_id)
    .maybeSingle()

  const required = hotel?.guest_rules_version ?? 1
  return (guest.guest_rules_accepted_version ?? 0) < required
}
