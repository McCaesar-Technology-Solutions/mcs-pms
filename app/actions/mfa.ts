'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME } from '@/lib/auth/roles'
import {
  hashOtp,
  hashSessionKey,
  generateOtpCode,
  maskPhone,
  maskEmail,
  MFA_OTP_TTL_MS,
  MFA_SEND_COOLDOWN_MS,
  MFA_SEND_MAX_PER_15_MIN,
} from '@/lib/auth/mfa-sms'
import { buildMfaStatus } from '@/lib/auth/mfa-status'
import { mfaRedirectPath, safeMfaNext, userNeedsMfa, type MfaMethod } from '@/lib/auth/mfa'
import { sendToPhone } from '@/lib/notifications/send'
import { sendToEmail } from '@/lib/notifications/send-email'
import { isEmailConfigured } from '@/lib/notifications/email-provider'
import { appUrl } from '@/lib/notifications/app-url'
import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { toE164 } from '@/lib/notifications/e164'
import { phoneSchema } from '@/lib/phone'
import type { UserRole } from '@/types'

export type MfaActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

interface StaffProfile {
  id: string
  role: UserRole
  hotel_id: string | null
  phone: string | null
  email: string
  mfa_enabled: boolean | null
  mfa_method: MfaMethod | null
  mfa_totp_secret: string | null
  mfa_totp_pending_secret: string | null
}

async function requireStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null as StaffProfile | null }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, role, hotel_id, phone, email, mfa_enabled, mfa_method, mfa_totp_secret, mfa_totp_pending_secret',
    )
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    profile: profile ? ({ ...profile, role: profile.role as UserRole } as StaffProfile) : null,
  }
}

function profileForStatus(profile: StaffProfile) {
  return {
    role: profile.role,
    phone: profile.phone,
    email: profile.email,
    mfa_enabled: profile.mfa_enabled,
    mfa_method: profile.mfa_method,
    mfa_totp_secret: profile.mfa_totp_secret,
  }
}

async function assertOtpRateLimit(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const since15m = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('mfa_otp_challenges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since15m)

  if ((count ?? 0) >= MFA_SEND_MAX_PER_15_MIN) {
    return 'Too many codes sent. Wait a few minutes and try again.'
  }

  const { data: latest } = await admin
    .from('mfa_otp_challenges')
    .select('created_at')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.created_at) {
    const elapsed = Date.now() - new Date(latest.created_at).getTime()
    if (elapsed < MFA_SEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((MFA_SEND_COOLDOWN_MS - elapsed) / 1000)
      return `Wait ${waitSec}s before requesting another code.`
    }
  }

  return null
}

async function createOtpChallenge(userId: string): Promise<
  MfaActionResult<{ code: string }>
> {
  const rateLimitError = await assertOtpRateLimit(userId)
  if (rateLimitError) return { success: false, error: rateLimitError }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + MFA_OTP_TTL_MS).toISOString()
  const admin = createAdminClient()
  const { error } = await admin.from('mfa_otp_challenges').insert({
    user_id: userId,
    code_hash: await hashOtp(code),
    expires_at: expiresAt,
  })

  if (error) {
    return { success: false, error: 'Could not create a verification code. Try again.' }
  }

  return { success: true, data: { code } }
}

async function verifyOtpChallenge(userId: string, trimmed: string): Promise<boolean> {
  const admin = createAdminClient()
  const codeHash = await hashOtp(trimmed)
  const now = new Date().toISOString()

  const { data: challenge } = await admin
    .from('mfa_otp_challenges')
    .select('id')
    .eq('user_id', userId)
    .eq('code_hash', codeHash)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!challenge) return false

  await admin.from('mfa_otp_challenges').update({ consumed_at: now }).eq('id', challenge.id)
  return true
}

async function loadStaffProfile(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select(
      'id, role, hotel_id, phone, email, mfa_enabled, mfa_method, mfa_totp_secret, mfa_totp_pending_secret',
    )
    .eq('id', userId)
    .maybeSingle()
  return data ? ({ ...data, role: data.role as UserRole } as StaffProfile) : null
}

/** Authenticator apps are no longer supported — move legacy rows to SMS or disable. */
export async function migrateLegacyTotpMfa(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('mfa_method, mfa_totp_secret, mfa_totp_pending_secret, phone, email')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return
  const hasTotp =
    data.mfa_method === 'totp' ||
    Boolean(data.mfa_totp_secret?.trim()) ||
    Boolean(data.mfa_totp_pending_secret?.trim())
  if (!hasTotp) return

  const hasPhone = Boolean(data.phone?.trim())
  const hasEmail = Boolean(data.email?.trim())
  const useSms = hasPhone
  const useEmail = !hasPhone && hasEmail

  await admin
    .from('profiles')
    .update({
      mfa_enabled: useSms || useEmail,
      mfa_method: useSms ? 'sms' : useEmail ? 'email' : null,
      mfa_sms_enabled: useSms,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', userId)
}

async function markSessionVerified(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<MfaActionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.refresh_token) {
    return { success: false, error: 'Your session expired. Sign in again.' }
  }

  const admin = createAdminClient()
  const sessionKey = await hashSessionKey(session.refresh_token)
  const now = new Date().toISOString()
  const sessionExpires = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await admin.from('mfa_verified_sessions').upsert(
    {
      user_id: userId,
      session_key: sessionKey,
      verified_at: now,
      expires_at: sessionExpires,
    },
    { onConflict: 'user_id,session_key' },
  )

  return { success: true }
}

/** Post-login redirect — always proceed to the app; 2FA is configured in Settings only. */
export async function getStaffMfaRedirect(intendedPath: string): Promise<string> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return '/login'
  return safeMfaNext(intendedPath, ROLE_HOME[profile.role])
}

export async function getMfaStatus(): Promise<
  MfaActionResult<{
    enabled: boolean
    method: MfaMethod | null
    hasPhone: boolean
    hasEmail: boolean
    hasTotp: boolean
    maskedPhone: string | null
    maskedEmail: string | null
    sessionVerified: boolean
  }>
> {
  const { supabase, user } = await requireStaffContext()
  if (!user) return { success: false, error: 'Not signed in.' }

  await migrateLegacyTotpMfa(user.id)
  const profile = (await loadStaffProfile(user.id)) ?? null
  if (!profile) return { success: false, error: 'Not signed in.' }

  const status = await buildMfaStatus(supabase, user.id, profileForStatus(profile))
  const method =
    profile.mfa_method === 'sms' || profile.mfa_method === 'email' ? profile.mfa_method : null

  return {
    success: true,
    data: {
      enabled: profile.mfa_enabled === true && method !== null,
      method,
      hasPhone: status.hasPhone,
      hasEmail: status.hasEmail,
      hasTotp: false,
      maskedPhone: profile.phone ? maskPhone(profile.phone) : null,
      maskedEmail: profile.email ? maskEmail(profile.email) : null,
      sessionVerified: status.sessionVerified,
    },
  }
}

/** @deprecated Use getMfaStatus */
export async function getMfaSmsStatus(): Promise<
  MfaActionResult<{
    required: boolean
    enabled: boolean
    hasPhone: boolean
    maskedPhone: string | null
    sessionVerified: boolean
  }>
> {
  const result = await getMfaStatus()
  if (!result.success || !result.data) return result as MfaActionResult<never>
  return {
    success: true,
    data: {
      required: false,
      enabled: result.data.enabled,
      hasPhone: result.data.hasPhone,
      maskedPhone: result.data.maskedPhone,
      sessionVerified: result.data.sessionVerified,
    },
  }
}

export async function disableMfa(): Promise<MfaActionResult> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      mfa_enabled: false,
      mfa_method: null,
      mfa_sms_enabled: false,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', user.id)

  if (error) return { success: false, error: 'Could not turn off two-factor authentication.' }

  await admin.from('mfa_verified_sessions').delete().eq('user_id', user.id)
  return { success: true }
}

/** @deprecated Use disableMfa */
export async function setMfaSmsEnabled(enabled: boolean): Promise<MfaActionResult> {
  if (!enabled) return disableMfa()
  return enableSmsMfa()
}

export async function enableSmsMfa(): Promise<MfaActionResult> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      mfa_enabled: true,
      mfa_method: 'sms',
      mfa_sms_enabled: true,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', user.id)

  if (error) return { success: false, error: 'Could not enable SMS verification.' }
  return { success: true }
}

export async function enableEmailMfa(): Promise<MfaActionResult> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!profile.email?.trim()) {
    return { success: false, error: 'Your account has no email address on file.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      mfa_enabled: true,
      mfa_method: 'email',
      mfa_sms_enabled: false,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', user.id)

  if (error) return { success: false, error: 'Could not enable email verification.' }
  return { success: true }
}

export async function sendMfaSmsCode(): Promise<
  MfaActionResult<{ maskedPhone: string; devCode?: string }>
> {
  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!userNeedsMfa(profile.mfa_enabled === true) || profile.mfa_method !== 'sms') {
    return { success: false, error: 'SMS verification is not enabled for this account.' }
  }

  const phone = profile.phone?.trim()
  if (!phone) {
    return { success: false, error: 'Add a phone number before verifying.' }
  }

  const e164 = toE164(phone)
  if (!e164) return { success: false, error: 'Your phone number looks invalid. Update it and try again.' }

  const created = await createOtpChallenge(user.id)
  if (!created.success || !created.data) {
    return created as MfaActionResult<{ maskedPhone: string; devCode?: string }>
  }
  const { code } = created.data

  const body = `Your MOJO Apartments sign-in code is ${code}. It expires in 5 minutes. Do not share this code.`
  const results = await sendToPhone(phone, body, {
    hotelId: profile.hotel_id ?? undefined,
    templateKey: 'mfa_otp',
    includeWhatsApp: false,
  })

  const sent = results.some((r) => r.success)
  const isDev = process.env.NODE_ENV === 'development' && !isSmsConfigured()

  if (!sent && !isDev) {
    return {
      success: false,
      error: 'Could not send the SMS. Check notification settings or try again shortly.',
    }
  }

  return {
    success: true,
    data: {
      maskedPhone: maskPhone(phone),
      ...(isDev ? { devCode: code } : {}),
    },
  }
}

export async function sendMfaEmailCode(): Promise<
  MfaActionResult<{ maskedEmail: string; devCode?: string }>
> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!userNeedsMfa(profile.mfa_enabled === true) || profile.mfa_method !== 'email') {
    return { success: false, error: 'Email verification is not enabled for this account.' }
  }

  const email = profile.email?.trim().toLowerCase()
  if (!email) {
    return { success: false, error: 'Your account has no email address on file.' }
  }

  const created = await createOtpChallenge(user.id)
  if (!created.success || !created.data) {
    return created as MfaActionResult<{ maskedEmail: string; devCode?: string }>
  }
  const { code } = created.data

  const result = await sendToEmail(
    email,
    {
      subject: 'Your MOJO Apartments sign-in code',
      preview: `Your sign-in code is ${code}. It expires in 5 minutes.`,
      lines: [
        `Your sign-in code is ${code}.`,
        'It expires in 5 minutes.',
        'Do not share this code with anyone.',
      ],
      actionUrl: appUrl('/login'),
      actionLabel: 'Sign in',
    },
    { hotelId: profile.hotel_id ?? undefined, templateKey: 'mfa_otp' },
  )

  const isDev = process.env.NODE_ENV === 'development' && !isEmailConfigured()

  if (!result.success && !isDev) {
    return {
      success: false,
      error: result.error ?? 'Could not send the email. Check RESEND_API_KEY and try again.',
    }
  }

  return {
    success: true,
    data: {
      maskedEmail: maskEmail(email),
      ...(isDev ? { devCode: code } : {}),
    },
  }
}

export async function verifyMfaSmsCode(
  code: string,
  intendedPath?: string,
): Promise<MfaActionResult<{ redirectTo: string }>> {
  const trimmed = code.replace(/\D/g, '')
  if (trimmed.length !== 6) {
    return { success: false, error: 'Enter the 6-digit code from your SMS.' }
  }

  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!userNeedsMfa(profile.mfa_enabled === true) || profile.mfa_method !== 'sms') {
    return { success: false, error: 'SMS verification is not enabled for this account.' }
  }

  const ok = await verifyOtpChallenge(user.id, trimmed)
  if (!ok) {
    return { success: false, error: 'Invalid or expired code. Request a new SMS and try again.' }
  }

  const verified = await markSessionVerified(supabase, user.id)
  if (!verified.success) return verified as MfaActionResult<{ redirectTo: string }>

  const next = safeMfaNext(intendedPath, ROLE_HOME[profile.role])
  return { success: true, data: { redirectTo: next } }
}

export async function verifyMfaEmailCode(
  code: string,
  intendedPath?: string,
): Promise<MfaActionResult<{ redirectTo: string }>> {
  const trimmed = code.replace(/\D/g, '')
  if (trimmed.length !== 6) {
    return { success: false, error: 'Enter the 6-digit code from your email.' }
  }

  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!userNeedsMfa(profile.mfa_enabled === true) || profile.mfa_method !== 'email') {
    return { success: false, error: 'Email verification is not enabled for this account.' }
  }

  const ok = await verifyOtpChallenge(user.id, trimmed)
  if (!ok) {
    return { success: false, error: 'Invalid or expired code. Request a new email and try again.' }
  }

  const verified = await markSessionVerified(supabase, user.id)
  if (!verified.success) return verified as MfaActionResult<{ redirectTo: string }>

  const next = safeMfaNext(intendedPath, ROLE_HOME[profile.role])
  return { success: true, data: { redirectTo: next } }
}

export async function saveMfaPhoneAndSend(phone: string): Promise<
  MfaActionResult<{ maskedPhone: string; devCode?: string }>
> {
  const parsed = phoneSchema.safeParse(phone)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid phone number.' }
  }

  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ phone: parsed.data.trim() })
    .eq('id', user.id)

  if (error) return { success: false, error: 'Could not save your phone number.' }

  if (profile.mfa_method !== 'sms') {
    await admin
      .from('profiles')
      .update({ mfa_enabled: true, mfa_method: 'sms', mfa_sms_enabled: true })
      .eq('id', user.id)
  }

  return sendMfaSmsCode()
}
