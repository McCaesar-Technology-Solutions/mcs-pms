'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toE164 } from '@/lib/notifications/e164'
import { inviteStaffSchema } from '@/lib/validations'
import { phoneSchema } from '@/lib/phone'
import type { Profile, UserRole } from '@/types'

export type StaffActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export type InviteStaffResult = {
  token: string
  role: 'manager' | 'technician' | 'receptionist'
  email?: string
  phone?: string
}

async function requireStaffProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (profile as Profile) ?? null
}

function allowedInviteRoles(role: UserRole): ('manager' | 'technician' | 'receptionist')[] {
  if (role === 'owner') return ['manager', 'technician', 'receptionist']
  if (role === 'manager') return ['technician', 'receptionist']
  return []
}

function canManageMember(actor: Profile, target: Profile): boolean {
  if (actor.id === target.id) return false
  if (actor.hotel_id !== target.hotel_id) return false
  if (target.role === 'owner') return false
  if (actor.role === 'owner') {
    return target.role === 'manager' || target.role === 'technician' || target.role === 'receptionist'
  }
  if (actor.role === 'manager') {
    return target.role === 'technician' || target.role === 'receptionist'
  }
  return false
}

/** Internal login email for technician invites (Supabase Auth requires an email). */
function technicianAuthEmail(token: string): string {
  return `tech+${token}@invite.mojo.local`
}

export async function inviteStaff(
  contact: string,
  role: 'manager' | 'technician' | 'receptionist',
): Promise<StaffActionResult<InviteStaffResult>> {
  const payload =
    role === 'technician'
      ? { role, phone: contact.trim() }
      : { role, email: contact.trim() }

  const parsed = inviteStaffSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message
    return { success: false, error: msg ?? 'Check the contact details and try again.' }
  }

  const profile = await requireStaffProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  if (!allowedInviteRoles(profile.role).includes(parsed.data.role)) {
    return { success: false, error: `You cannot invite a ${parsed.data.role}.` }
  }

  const admin = createAdminClient()

  // Manager and receptionist invites are email-based.
  if (parsed.data.role === 'manager' || parsed.data.role === 'receptionist') {
    const inviteRole = parsed.data.role
    const normalizedEmail = parsed.data.email!.trim().toLowerCase()

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('hotel_id', profile.hotel_id)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      return { success: false, error: 'Someone with that email is already on your team.' }
    }

    const { data: existingInvite } = await admin
      .from('staff_invites')
      .select('id')
      .eq('hotel_id', profile.hotel_id)
      .eq('email', normalizedEmail)
      .eq('accepted', false)
      .maybeSingle()

    if (existingInvite) {
      return { success: false, error: 'There is already a pending invite for that email.' }
    }

    const { data: invite, error } = await admin
      .from('staff_invites')
      .insert({
        hotel_id: profile.hotel_id,
        email: normalizedEmail,
        role: inviteRole,
        invited_by: profile.id,
      })
      .select('token')
      .single()

    if (error || !invite) {
      return { success: false, error: 'Could not create the invite. Try again.' }
    }

    revalidatePath('/owner/staff')
    revalidatePath('/manager/staff')

    return {
      success: true,
      data: { token: invite.token, email: normalizedEmail, role: inviteRole },
    }
  }

  const phoneParsed = phoneSchema.safeParse(parsed.data.phone)
  if (!phoneParsed.success) {
    return { success: false, error: phoneParsed.error.issues[0]?.message ?? 'Invalid phone number.' }
  }

  const normalizedPhone = toE164(phoneParsed.data.trim())
  if (!normalizedPhone) {
    return { success: false, error: 'Enter a valid phone number.' }
  }

  const { data: staffAtHotel } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('hotel_id', profile.hotel_id)
    .eq('role', 'technician')

  for (const member of staffAtHotel ?? []) {
    if (member.phone && toE164(member.phone) === normalizedPhone) {
      return { success: false, error: 'A technician with that phone number is already on your team.' }
    }
  }

  const { data: pendingInvites } = await admin
    .from('staff_invites')
    .select('id, phone')
    .eq('hotel_id', profile.hotel_id)
    .eq('role', 'technician')
    .eq('accepted', false)

  for (const inv of pendingInvites ?? []) {
    if (inv.phone && toE164(inv.phone) === normalizedPhone) {
      return { success: false, error: 'There is already a pending invite for that phone number.' }
    }
  }

  const token = randomUUID()
  const authEmail = technicianAuthEmail(token)

  const { data: invite, error } = await admin
    .from('staff_invites')
    .insert({
      hotel_id: profile.hotel_id,
      email: authEmail,
      phone: normalizedPhone,
      role: 'technician',
      invited_by: profile.id,
      token,
    })
    .select('token')
    .single()

  if (error || !invite) {
    return { success: false, error: 'Could not create the invite. Try again.' }
  }

  revalidatePath('/owner/staff')
  revalidatePath('/manager/staff')

  return {
    success: true,
    data: { token: invite.token, phone: normalizedPhone, role: 'technician' },
  }
}

export async function revokeInvite(inviteId: string): Promise<StaffActionResult> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }
  if (profile.role !== 'owner' && profile.role !== 'manager') {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('staff_invites')
    .delete()
    .eq('id', inviteId)
    .eq('hotel_id', profile.hotel_id)
    .eq('accepted', false)

  if (error) return { success: false, error: 'Could not revoke the invite.' }

  revalidatePath('/owner/staff')
  revalidatePath('/manager/staff')
  return { success: true }
}

export async function setStaffActive(
  profileId: string,
  isActive: boolean,
): Promise<StaffActionResult> {
  const actor = await requireStaffProfile()
  if (!actor?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle()

  if (!target) return { success: false, error: 'Team member not found.' }
  if (!canManageMember(actor, target as Profile)) {
    return { success: false, error: 'You cannot manage this team member.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)

  if (error) return { success: false, error: 'Could not update the team member.' }

  revalidatePath('/owner/staff')
  revalidatePath('/manager/staff')
  return { success: true }
}

export async function updateStaffPhone(
  profileId: string,
  phone: string,
): Promise<StaffActionResult> {
  const parsed = phoneSchema.safeParse(phone)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid phone number.' }
  }

  const actor = await requireStaffProfile()
  if (!actor?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle()

  if (!target) return { success: false, error: 'Team member not found.' }

  const isSelf = actor.id === profileId
  if (!isSelf && !canManageMember(actor, target as Profile)) {
    return { success: false, error: 'You cannot update this team member.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ phone: parsed.data.trim() })
    .eq('id', profileId)

  if (error) return { success: false, error: 'Could not update phone number.' }

  revalidatePath('/owner/staff')
  revalidatePath('/manager/staff')
  revalidatePath('/', 'layout')
  return { success: true }
}
