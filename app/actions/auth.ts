'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { seedDefaultRoomCategories } from '@/lib/data/room-categories'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'
import {
  acceptInviteSchema,
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpOwnerSchema,
} from '@/lib/validations'
import type { UserRole } from '@/types'

export type AuthActionResult =
  | { success: true; role: UserRole; redirectTo: string }
  | { success: false; error: string }

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string }

/** Resolve the app's public origin for building email redirect links. */
async function resolveOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : ''
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({ email, password })
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut()
    return { success: false, error: 'This account has been disabled. Contact your administrator.' }
  }

  if (!isStaffRole(profile.role)) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  // Clear stale "required MFA" flags left from the old policy (enabled but never set up).
  const admin = createAdminClient()
  const { data: mfaRow } = await admin
    .from('profiles')
    .select('mfa_enabled, mfa_method, mfa_totp_secret, phone')
    .eq('id', data.user.id)
    .maybeSingle()

  if (mfaRow?.mfa_enabled) {
    const incompleteTotp = mfaRow.mfa_method === 'totp' && !mfaRow.mfa_totp_secret?.trim()
    const incompleteSms = mfaRow.mfa_method === 'sms' && !mfaRow.phone?.trim()
    if (incompleteTotp || incompleteSms || !mfaRow.mfa_method) {
      await admin
        .from('profiles')
        .update({
          mfa_enabled: false,
          mfa_method: null,
          mfa_sms_enabled: false,
          mfa_totp_secret: null,
          mfa_totp_pending_secret: null,
        })
        .eq('id', data.user.id)
    }
  }

  const redirectTo = ROLE_HOME[profile.role]
  return { success: true, role: profile.role, redirectTo }
}

/**
 * Send a password-reset email. Always reports success so the response never
 * reveals whether an email is registered.
 */
export async function requestPasswordReset(email: string): Promise<SimpleActionResult> {
  const parsed = requestResetSchema.safeParse({ email })
  if (!parsed.success) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  const origin = await resolveOrigin()
  if (!origin) {
    return { success: false, error: 'Could not determine the site address. Try again later.' }
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  return { success: true }
}

/**
 * Set a new password for the user in the current (recovery) session, then sign
 * them out so they re-authenticate with the new credentials.
 */
export async function updatePassword(
  password: string,
  confirm: string,
): Promise<SimpleActionResult> {
  const parsed = resetPasswordSchema.safeParse({ password, confirm })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid password.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Your reset link has expired. Request a new one.' }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return { success: false, error: 'Could not update your password. Try again.' }
  }

  await supabase.auth.signOut()
  return { success: true }
}

export async function signUpOwner(input: {
  name: string
  email: string
  password: string
  hotelName: string
  hotelAddress?: string
}): Promise<AuthActionResult> {
  const parsed = signUpOwnerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }

  const admin = createAdminClient()

  // Create the auth user (email pre-confirmed, no SMTP dependency).
  const { data: authUser, error: signUpError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name },
  })

  if (signUpError || !authUser.user) {
    const already = signUpError?.message?.toLowerCase().includes('already')
    return {
      success: false,
      error: already
        ? 'An account with this email already exists. Try signing in.'
        : signUpError?.message ?? 'Could not create account.',
    }
  }

  const userId = authUser.user.id

  // Profile must exist before hotel insert when owner_id FK targets profiles (migration 005).
  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    hotel_id: null,
    role: 'owner',
    name: parsed.data.name,
    email: parsed.data.email,
    is_active: true,
    mfa_enabled: false,
    mfa_method: null,
    mfa_sms_enabled: false,
  })

  if (profileError) {
    console.error('[signUpOwner] profile insert failed:', profileError.message)
    await admin.auth.admin.deleteUser(userId)
    return { success: false, error: 'Could not complete registration. Please try again.' }
  }

  const { data: hotel, error: hotelError } = await admin
    .from('hotels')
    .insert({
      name: parsed.data.hotelName.trim(),
      address: parsed.data.hotelAddress?.trim() || null,
      city: 'Accra',
      region: 'Greater Accra',
      owner_id: userId,
    })
    .select('id')
    .single()

  if (hotelError || !hotel) {
    console.error('[signUpOwner] hotel insert failed:', hotelError?.message)
    await admin.from('profiles').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)

    const msg = hotelError?.message?.toLowerCase() ?? ''
    if (msg.includes('owner_id') && (msg.includes('column') || msg.includes('schema cache'))) {
      return {
        success: false,
        error:
          'Database setup is incomplete. Run Supabase migration 005_owner_properties.sql, then try again.',
      }
    }
    if (msg.includes('violates foreign key') && msg.includes('owner_id')) {
      return {
        success: false,
        error:
          'Database setup needs an update. Run Supabase migration 006_hotels_owner_auth_users.sql, then try again.',
      }
    }

    return { success: false, error: 'Could not create your property. Please try again.' }
  }

  await seedDefaultRoomCategories(admin, hotel.id)

  const { error: linkError } = await admin
    .from('profiles')
    .update({ hotel_id: hotel.id })
    .eq('id', userId)

  if (linkError) {
    console.error('[signUpOwner] profile link failed:', linkError.message)
    await admin.from('hotels').delete().eq('id', hotel.id)
    await admin.from('profiles').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
    return { success: false, error: 'Could not complete registration. Please try again.' }
  }

  // Sign the new owner in.
  const supabase = await createClient()
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (loginError) {
    return { success: false, error: 'Account created but sign-in failed. Please log in manually.' }
  }

  await admin
    .from('profiles')
    .update({
      mfa_enabled: false,
      mfa_method: null,
      mfa_sms_enabled: false,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', userId)

  return { success: true, role: 'owner', redirectTo: ROLE_HOME.owner }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function acceptInvite(
  token: string,
  name: string,
  password: string,
  phone: string,
): Promise<AuthActionResult> {
  const parsed = acceptInviteSchema.safeParse({ token, name, password, phone })
  if (!parsed.success) {
    return { success: false, error: 'Please check your details and try again.' }
  }

  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('staff_invites')
    .select('*')
    .eq('token', parsed.data.token)
    .eq('accepted', false)
    .maybeSingle()

  if (inviteError || !invite) {
    return { success: false, error: 'This invite link is invalid or has already been used.' }
  }

  const { data: authUser, error: signUpError } = await admin.auth.admin.createUser({
    email: invite.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name },
  })

  if (signUpError || !authUser.user) {
    return { success: false, error: signUpError?.message ?? 'Could not create account.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    hotel_id: invite.hotel_id,
    role: invite.role,
    name: parsed.data.name,
    email: invite.email,
    phone: parsed.data.phone.trim(),
    invited_by: invite.invited_by,
    is_active: true,
    mfa_enabled: false,
    mfa_method: null,
    mfa_sms_enabled: false,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: 'Could not complete registration.' }
  }

  await admin.from('staff_invites').update({ accepted: true }).eq('id', invite.id)

  const supabase = await createClient()
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  })

  if (loginError) {
    return { success: false, error: 'Account created but sign-in failed. Please log in manually.' }
  }

  await admin
    .from('profiles')
    .update({
      mfa_enabled: false,
      mfa_method: null,
      mfa_sms_enabled: false,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', authUser.user.id)

  const role = invite.role as UserRole
  return { success: true, role, redirectTo: ROLE_HOME[role] }
}
