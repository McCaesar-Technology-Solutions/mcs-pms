'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME } from '@/lib/auth/roles'
import {
  hashOtp,
  generateOtpCode,
  maskPhone,
  maskEmail,
  MFA_OTP_TTL_MS,
  MFA_SEND_COOLDOWN_MS,
  MFA_SEND_MAX_PER_15_MIN,
} from '@/lib/auth/mfa-sms'
import { mfaVerifiedExpiresAt, resolveMfaSessionKey } from '@/lib/auth/mfa-session-key'
import { buildMfaStatus } from '@/lib/auth/mfa-status'
import { migrateLegacyTotpMfa } from '@/lib/auth/migrate-legacy-totp'
import {
  mfaRedirectPath,
  roleRequiresMfa,
  safeMfaNext,
  userNeedsMfa,
  type MfaMethod,
} from '@/lib/auth/mfa'
import { assertRateLimit, AUTH_RATE_LIMITS, authRateKey } from '@/lib/rate-limit'
import { sendToPhone } from '@/lib/notifications/send'
import { sendToEmail } from '@/lib/notifications/send-email'
import { isEmailConfigured } from '@/lib/notifications/email-provider'
import { appUrl } from '@/lib/notifications/app-url'
import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { toE164 } from '@/lib/notifications/e164'
import {
  checkTwilioVerification,
  isTwilioVerifyConfigured,
  resolvePhoneVerifyChannel,
  sendTwilioVerification,
  twilioVerifyChannelLabel,
} from '@/lib/notifications/twilio-verify'
import { shouldUseTwilioVerifyForPhone } from '@/lib/notifications/termii'
import {
  mfaPhoneChannelLabel,
  resolveMfaPhoneChannel,
  resolveMfaPhoneChannels,
  type MfaPhoneChannel,
} from '@/lib/notifications/mfa-phone-channels'
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

function mfaActionError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.message.includes('MFA_OTP_SECRET')) {
      return 'Two-factor authentication is not configured on this server (missing MFA_OTP_SECRET). Add it in your deployment environment variables and redeploy.'
    }
    if (err.message.includes('Supabase admin')) {
      return 'Server configuration error. Contact your administrator.'
    }
    return err.message
  }
  return fallback
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
  try {
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
  } catch (err) {
    console.error('[mfa] createOtpChallenge failed:', err)
    return {
      success: false,
      error: mfaActionError(err, 'Could not create a verification code. Try again.'),
    }
  }
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

async function recordExternalVerifySend(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('mfa_otp_challenges').insert({
    user_id: userId,
    code_hash: 'twilio-verify',
    expires_at: new Date(Date.now() + MFA_OTP_TTL_MS).toISOString(),
  })
}

function phoneVerifyDestination(phone: string): string | null {
  return toE164(phone)
}

async function sendPhoneMfaCode(
  userId: string,
  profile: StaffProfile,
  phone: string,
  requestedChannel?: string,
): Promise<
  MfaActionResult<{ maskedPhone: string; devCode?: string; deliveryChannel?: 'sms' | 'whatsapp' }>
> {
  const e164 = phoneVerifyDestination(phone)
  if (!e164) {
    return { success: false, error: 'Your phone number looks invalid. Update it and try again.' }
  }

  const channelResult = resolveMfaPhoneChannel(requestedChannel)
  if (typeof channelResult === 'object' && 'error' in channelResult) {
    return { success: false, error: channelResult.error }
  }
  const channel = channelResult

  const rateLimitError = await assertOtpRateLimit(userId)
  if (rateLimitError) return { success: false, error: rateLimitError }

  if (shouldUseTwilioVerifyForPhone()) {
    const twilioChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms'
    const sent = await sendTwilioVerification(e164, twilioChannel)
    if (!sent.success) {
      return { success: false, error: sent.error ?? 'Could not send the verification code.' }
    }
    await recordExternalVerifySend(userId)
    return {
      success: true,
      data: {
        maskedPhone: maskPhone(phone),
        deliveryChannel: twilioChannel,
      },
    }
  }

  const created = await createOtpChallenge(userId)
  if (!created.success || !created.data) {
    return created as MfaActionResult<{
      maskedPhone: string
      devCode?: string
      deliveryChannel?: 'sms' | 'whatsapp'
    }>
  }
  const { code } = created.data

  const body = `Your MOJO Apartments sign-in code is ${code}. It expires in 5 minutes. Do not share this code.`
  const results = await sendToPhone(phone, body, {
    hotelId: profile.hotel_id ?? undefined,
    templateKey: 'mfa_otp',
    onlyChannels: [channel],
  })

  const sent = results.some((r) => r.success && r.channel === channel)
  const isDev = process.env.NODE_ENV === 'development' && resolveMfaPhoneChannels().length === 0

  if (!sent && !isDev) {
    return {
      success: false,
      error: `Could not send the code via ${mfaPhoneChannelLabel(channel)}. Try the other option or try again shortly.`,
    }
  }

  return {
    success: true,
    data: {
      maskedPhone: maskPhone(phone),
      deliveryChannel: channel,
      ...(isDev ? { devCode: code } : {}),
    },
  }
}

async function sendEmailMfaCode(
  userId: string,
  profile: StaffProfile,
  email: string,
): Promise<MfaActionResult<{ maskedEmail: string; devCode?: string }>> {
  const rateLimitError = await assertOtpRateLimit(userId)
  if (rateLimitError) return { success: false, error: rateLimitError }

  if (isTwilioVerifyConfigured()) {
    const sent = await sendTwilioVerification(email, 'email')
    if (!sent.success) {
      return { success: false, error: sent.error ?? 'Could not send the verification code.' }
    }
    await recordExternalVerifySend(userId)
    return { success: true, data: { maskedEmail: maskEmail(email) } }
  }

  const created = await createOtpChallenge(userId)
  if (!created.success || !created.data) {
    return created as MfaActionResult<{ maskedEmail: string; devCode?: string }>
  }
  const { code } = created.data

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        data: { maskedEmail: maskEmail(email), devCode: code },
      }
    }
    return {
      success: false,
      error:
        'Email is not configured on this server. Add TWILIO_VERIFY_SERVICE_SID for Verify email, or RESEND_API_KEY, then redeploy.',
    }
  }

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

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Could not send the email. Check RESEND_API_KEY and try again.',
    }
  }

  return { success: true, data: { maskedEmail: maskEmail(email) } }
}

async function confirmMfaCode(profile: StaffProfile, userId: string, trimmed: string): Promise<boolean> {
  if (profile.mfa_method === 'email' && isTwilioVerifyConfigured()) {
    const to = profile.email?.trim().toLowerCase()
    if (!to) return false
    const checked = await checkTwilioVerification(to, trimmed)
    return checked.success
  }

  if (profile.mfa_method === 'sms' && shouldUseTwilioVerifyForPhone()) {
    const to = profile.phone ? phoneVerifyDestination(profile.phone) : null
    if (!to) return false
    const checked = await checkTwilioVerification(to, trimmed)
    return checked.success
  }

  return verifyOtpChallenge(userId, trimmed)
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

async function markSessionVerified(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<MfaActionResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token && !session?.refresh_token) {
      return { success: false, error: 'Your session expired. Sign in again.' }
    }

    const admin = createAdminClient()
    const sessionKey = await resolveMfaSessionKey(session)
    if (!sessionKey) {
      return { success: false, error: 'Your session expired. Sign in again.' }
    }
    const now = new Date().toISOString()

    await admin.from('mfa_verified_sessions').upsert(
      {
        user_id: userId,
        session_key: sessionKey,
        verified_at: now,
        expires_at: mfaVerifiedExpiresAt(),
      },
      { onConflict: 'user_id,session_key' },
    )

    return { success: true }
  } catch (err) {
    console.error('[mfa] markSessionVerified failed:', err)
    return {
      success: false,
      error: mfaActionError(err, 'Could not complete verification. Try again.'),
    }
  }
}

/** Post-login redirect — send staff through enroll/verify when required. */
export async function getStaffMfaRedirect(intendedPath: string): Promise<string> {
  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return '/login'
  const status = await buildMfaStatus(supabase, user.id, profileForStatus(profile))
  return mfaRedirectPath(profile.role, status, ROLE_HOME[profile.role], intendedPath)
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
    usesTwilioVerify: boolean
    phoneDeliveryChannel: 'sms' | 'whatsapp' | null
    phoneChannels: MfaPhoneChannel[]
  }>
> {
  try {
    const { supabase, user } = await requireStaffContext()
    if (!user) return { success: false, error: 'Not signed in.' }

    await migrateLegacyTotpMfa(user.id)
    const profile = (await loadStaffProfile(user.id)) ?? null
    if (!profile) return { success: false, error: 'Not signed in.' }

    const status = await buildMfaStatus(supabase, user.id, profileForStatus(profile))
    const method =
      profile.mfa_method === 'sms' || profile.mfa_method === 'email' ? profile.mfa_method : null

    const phoneChannels = method === 'sms' ? resolveMfaPhoneChannels() : []

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
        usesTwilioVerify:
          profile.mfa_method === 'email'
            ? isTwilioVerifyConfigured()
            : shouldUseTwilioVerifyForPhone(),
        phoneDeliveryChannel:
          method === 'sms' && phoneChannels.length === 1 ? phoneChannels[0]! : null,
        phoneChannels,
      },
    }
  } catch (err) {
    console.error('[mfa] getMfaStatus failed:', err)
    return {
      success: false,
      error: mfaActionError(err, 'Could not load verification settings. Refresh and try again.'),
    }
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
    phoneChannels: MfaPhoneChannel[]
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
      phoneChannels: result.data.phoneChannels,
    },
  }
}

export async function disableMfa(): Promise<MfaActionResult> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (roleRequiresMfa(profile.role)) {
    return {
      success: false,
      error: 'Two-factor authentication is required for your role and cannot be disabled.',
    }
  }

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

export async function sendMfaSmsCode(
  channel?: MfaPhoneChannel,
): Promise<
  MfaActionResult<{ maskedPhone: string; devCode?: string; deliveryChannel?: 'sms' | 'whatsapp' }>
> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!userNeedsMfa(profile.role, profile.mfa_enabled === true) || profile.mfa_method !== 'sms') {
    return { success: false, error: 'Phone verification is not enabled for this account.' }
  }

  const phone = profile.phone?.trim()
  if (!phone) {
    return { success: false, error: 'Add a phone number before verifying.' }
  }

  return sendPhoneMfaCode(user.id, profile, phone, channel)
}

export async function sendMfaEmailCode(): Promise<
  MfaActionResult<{ maskedEmail: string; devCode?: string }>
> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  if (!userNeedsMfa(profile.role, profile.mfa_enabled === true) || profile.mfa_method !== 'email') {
    return { success: false, error: 'Email verification is not enabled for this account.' }
  }

  const email = profile.email?.trim().toLowerCase()
  if (!email) {
    return { success: false, error: 'Your account has no email address on file.' }
  }

  return sendEmailMfaCode(user.id, profile, email)
}

export async function verifyMfaSmsCode(
  code: string,
  intendedPath?: string,
): Promise<MfaActionResult<{ redirectTo: string }>> {
  const trimmed = code.replace(/\D/g, '')
  if (trimmed.length !== 6) {
    return { success: false, error: 'Enter the 6-digit code from your message.' }
  }

  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const verifyLimit = await assertRateLimit(
    authRateKey('mfa-verify', user.id),
    AUTH_RATE_LIMITS.mfaVerify,
    'Too many verification attempts. Wait a few minutes and try again.',
  )
  if (verifyLimit) return { success: false, error: verifyLimit }

  if (!userNeedsMfa(profile.role, profile.mfa_enabled === true) || profile.mfa_method !== 'sms') {
    return { success: false, error: 'Phone verification is not enabled for this account.' }
  }

  const ok = await confirmMfaCode(profile, user.id, trimmed)
  if (!ok) {
    const channels = resolveMfaPhoneChannels()
    const label =
      channels.length > 1
        ? 'SMS or WhatsApp'
        : shouldUseTwilioVerifyForPhone()
          ? twilioVerifyChannelLabel(resolvePhoneVerifyChannel())
          : mfaPhoneChannelLabel(channels[0] ?? 'sms')
    return {
      success: false,
      error: `Invalid or expired code. Request a new ${label} message and try again.`,
    }
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

  const verifyLimit = await assertRateLimit(
    authRateKey('mfa-verify', user.id),
    AUTH_RATE_LIMITS.mfaVerify,
    'Too many verification attempts. Wait a few minutes and try again.',
  )
  if (verifyLimit) return { success: false, error: verifyLimit }

  if (!userNeedsMfa(profile.role, profile.mfa_enabled === true) || profile.mfa_method !== 'email') {
    return { success: false, error: 'Email verification is not enabled for this account.' }
  }

  const ok = await confirmMfaCode(profile, user.id, trimmed)
  if (!ok) {
    return { success: false, error: 'Invalid or expired code. Request a new email and try again.' }
  }

  const verified = await markSessionVerified(supabase, user.id)
  if (!verified.success) return verified as MfaActionResult<{ redirectTo: string }>

  const next = safeMfaNext(intendedPath, ROLE_HOME[profile.role])
  return { success: true, data: { redirectTo: next } }
}

export async function saveMfaPhoneAndSend(
  phone: string,
  channel?: MfaPhoneChannel,
): Promise<
  MfaActionResult<{ maskedPhone: string; devCode?: string; deliveryChannel?: 'sms' | 'whatsapp' }>
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

  const savedPhone = parsed.data.trim()
  if (!channel) {
    return { success: true, data: { maskedPhone: maskPhone(savedPhone) } }
  }

  const refreshedProfile = { ...profile, phone: savedPhone }
  return sendPhoneMfaCode(user.id, refreshedProfile, savedPhone, channel)
}
