'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteStaffSchema } from '@/lib/validations'
import type { Profile, UserRole } from '@/types'

export type StaffActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

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

function allowedInviteRoles(role: UserRole): ('manager' | 'technician')[] {
  if (role === 'owner') return ['manager', 'technician']
  if (role === 'manager') return ['technician']
  return []
}

function canManageMember(actor: Profile, target: Profile): boolean {
  if (actor.id === target.id) return false
  if (actor.hotel_id !== target.hotel_id) return false
  if (target.role === 'owner') return false
  if (actor.role === 'owner') return target.role === 'manager' || target.role === 'technician'
  if (actor.role === 'manager') return target.role === 'technician'
  return false
}

export async function inviteStaff(
  email: string,
  role: 'manager' | 'technician',
): Promise<StaffActionResult<{ token: string; email: string; role: 'manager' | 'technician' }>> {
  const parsed = inviteStaffSchema.safeParse({ email, role })
  if (!parsed.success) {
    return { success: false, error: 'Enter a valid email and role.' }
  }

  const profile = await requireStaffProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  if (!allowedInviteRoles(profile.role).includes(parsed.data.role)) {
    return { success: false, error: `You cannot invite a ${parsed.data.role}.` }
  }

  const admin = createAdminClient()
  const normalizedEmail = parsed.data.email.trim().toLowerCase()

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
      role: parsed.data.role,
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
    data: { token: invite.token, email: normalizedEmail, role: parsed.data.role },
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
