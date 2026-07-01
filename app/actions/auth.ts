'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'
import { getAppOrigin, isPublicSignupAllowed } from '@/lib/env'
import { getClientIp } from '@/lib/auth/client-ip'
import {
  assertRateLimit,
  AUTH_RATE_LIMITS,
  authRateKey,
  ipRateKey,
} from '@/lib/rate-limit'
import {
  acceptInviteSchema,
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpOwnerSchema,
} from '@/lib/validations'
import { resolveSignInEmail } from '@/lib/auth/resolve-sign-in'
import type { UserRole } from '@/types'

export type AuthActionResult =
  | { success: true; role: UserRole; redirectTo: string }
  | { success: false; error: string }

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string }

const INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function resolveOrigin(): Promise<string> {
  if (process.env.NODE_ENV === 'production') {
    return getAppOrigin()
  }
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

async function staffRedirectAfterAuth(intendedPath: string): Promise<string> {
  const { getStaffMfaRedirect } = await import('@/app/actions/mfa')
  return getStaffMfaRedirect(intendedPath)
}

export async function signIn(
  identifier: string,
  password: string,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({ identifier, password })
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const email = await resolveSignInEmail(parsed.data.identifier)
  if (!email) {
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  const ip = await getClientIp()
  const rateKey = parsed.data.identifier.trim().toLowerCase()
  const ipLimit = await assertRateLimit(
    ipRateKey('sign-in', ip),
    AUTH_RATE_LIMITS.signIn,
    'Too many sign-in attempts. Please wait and try again.',
  )
  if (ipLimit) return { success: false, error: ipLimit }

  const accountLimit = await assertRateLimit(
    authRateKey('sign-in', rateKey),
    AUTH_RATE_LIMITS.signIn,
    'Too many sign-in attempts. Please wait and try again.',
  )
  if (accountLimit) return { success: false, error: accountLimit }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'Your account profile is missing. Ask an owner to re-invite you or contact support.',
    }
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut()
    return { success: false, error: 'This account has been disabled. Contact your administrator.' }
  }

  if (!isStaffRole(profile.role)) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  const { migrateLegacyTotpMfa } = await import('@/lib/auth/migrate-legacy-totp')
  await migrateLegacyTotpMfa(data.user.id)

  const redirectTo = await staffRedirectAfterAuth(ROLE_HOME[profile.role])
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

  const ip = await getClientIp()
  const limit = await assertRateLimit(
    ipRateKey('password-reset', ip),
    AUTH_RATE_LIMITS.passwordReset,
  )
  if (limit) return { success: false, error: limit }

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
  confirmPassword: string
}): Promise<AuthActionResult> {
  if (!isPublicSignupAllowed()) {
    return {
      success: false,
      error: 'Self-service registration is disabled. Contact your administrator for access.',
    }
  }

  const parsed = signUpOwnerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }

  const ip = await getClientIp()
  const ipLimit = await assertRateLimit(ipRateKey('sign-up', ip), AUTH_RATE_LIMITS.signUp)
  if (ipLimit) return { success: false, error: ipLimit }

  const admin = createAdminClient()

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

  return {
    success: true,
    role: 'owner',
    redirectTo: '/get-started',
  }
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
  confirmPassword: string,
  phone: string,
): Promise<AuthActionResult> {
  const parsed = acceptInviteSchema.safeParse({ token, name, password, confirmPassword, phone })
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

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { success: false, error: 'This invite link has expired. Ask your manager for a new invite.' }
  }

  const ip = await getClientIp()
  const inviteLimit = await assertRateLimit(
    ipRateKey('accept-invite', ip),
    AUTH_RATE_LIMITS.acceptInvite,
  )
  if (inviteLimit) return { success: false, error: inviteLimit }

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
  return {
    success: true,
    role,
    redirectTo: await staffRedirectAfterAuth(ROLE_HOME[role]),
  }
}
