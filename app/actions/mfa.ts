'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME } from '@/lib/auth/roles'
import {
  hashOtp,
  hashSessionKey,
  generateOtpCode,
  maskPhone,
  MFA_OTP_TTL_MS,
  MFA_SEND_COOLDOWN_MS,
  MFA_SEND_MAX_PER_15_MIN,
} from '@/lib/auth/mfa-sms'
import { buildMfaStatus } from '@/lib/auth/mfa-status'
import {
  isMfaRequired,
  mfaRedirectPath,
  safeMfaNext,
  userNeedsMfa,
} from '@/lib/auth/mfa'
import { sendToPhone } from '@/lib/notifications/send'
import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { toE164 } from '@/lib/notifications/e164'
import { phoneSchema } from '@/lib/phone'
import type { UserRole } from '@/types'

export type MfaActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, phone, mfa_sms_enabled')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, user, profile }
}

/** Post-login redirect — enroll (no phone), verify (SMS code), or dashboard. */
export async function getStaffMfaRedirect(intendedPath: string): Promise<string> {
  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return '/login'

  const role = profile.role as UserRole
  const status = await buildMfaStatus(supabase, user.id, {
    role,
    phone: profile.phone,
    mfa_sms_enabled: profile.mfa_sms_enabled,
  })

  return mfaRedirectPath(role, status, ROLE_HOME[role], intendedPath)
}

export async function getMfaSmsStatus(): Promise<
  MfaActionResult<{
    required: boolean
    enabled: boolean
    hasPhone: boolean
    maskedPhone: string | null
    sessionVerified: boolean
  }>
> {
  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const role = profile.role as UserRole
  const status = await buildMfaStatus(supabase, user.id, {
    role,
    phone: profile.phone,
    mfa_sms_enabled: profile.mfa_sms_enabled,
  })

  return {
    success: true,
    data: {
      required: isMfaRequired(role),
      enabled: userNeedsMfa(role, profile.mfa_sms_enabled === true),
      hasPhone: status.hasPhone,
      maskedPhone: profile.phone ? maskPhone(profile.phone) : null,
      sessionVerified: status.sessionVerified,
    },
  }
}

export async function sendMfaSmsCode(): Promise<
  MfaActionResult<{ maskedPhone: string; devCode?: string }>
> {
  const { supabase, user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const role = profile.role as UserRole
  if (!userNeedsMfa(role, profile.mfa_sms_enabled === true)) {
    return { success: false, error: 'SMS verification is not enabled for this account.' }
  }

  const phone = profile.phone?.trim()
  if (!phone) {
    return { success: false, error: 'Add a phone number before verifying.' }
  }

  const e164 = toE164(phone)
  if (!e164) return { success: false, error: 'Your phone number looks invalid. Update it and try again.' }

  const admin = createAdminClient()
  const since15m = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('mfa_otp_challenges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since15m)

  if ((count ?? 0) >= MFA_SEND_MAX_PER_15_MIN) {
    return { success: false, error: 'Too many codes sent. Wait a few minutes and try again.' }
  }

  const { data: latest } = await admin
    .from('mfa_otp_challenges')
    .select('created_at')
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.created_at) {
    const elapsed = Date.now() - new Date(latest.created_at).getTime()
    if (elapsed < MFA_SEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((MFA_SEND_COOLDOWN_MS - elapsed) / 1000)
      return { success: false, error: `Wait ${waitSec}s before requesting another code.` }
    }
  }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + MFA_OTP_TTL_MS).toISOString()

  const { error: insertError } = await admin.from('mfa_otp_challenges').insert({
    user_id: user.id,
    code_hash: await hashOtp(code),
    expires_at: expiresAt,
  })

  if (insertError) {
    return { success: false, error: 'Could not create a verification code. Try again.' }
  }

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

  const role = profile.role as UserRole
  if (!userNeedsMfa(role, profile.mfa_sms_enabled === true)) {
    return { success: false, error: 'SMS verification is not required for this account.' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.refresh_token) {
    return { success: false, error: 'Your session expired. Sign in again.' }
  }

  const admin = createAdminClient()
  const codeHash = await hashOtp(trimmed)
  const now = new Date().toISOString()

  const { data: challenge } = await admin
    .from('mfa_otp_challenges')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', codeHash)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!challenge) {
    return { success: false, error: 'Invalid or expired code. Request a new SMS and try again.' }
  }

  await admin
    .from('mfa_otp_challenges')
    .update({ consumed_at: now })
    .eq('id', challenge.id)

  const sessionKey = await hashSessionKey(session.refresh_token)
  const sessionExpires = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await admin.from('mfa_verified_sessions').upsert(
    {
      user_id: user.id,
      session_key: sessionKey,
      verified_at: now,
      expires_at: sessionExpires,
    },
    { onConflict: 'user_id,session_key' },
  )

  const next = safeMfaNext(intendedPath, ROLE_HOME[role])
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

  const { error } = await supabase
    .from('profiles')
    .update({ phone: parsed.data.trim() })
    .eq('id', user.id)

  if (error) return { success: false, error: 'Could not save your phone number.' }

  return sendMfaSmsCode()
}

export async function setMfaSmsEnabled(enabled: boolean): Promise<MfaActionResult> {
  const { user, profile } = await requireStaffContext()
  if (!user || !profile) return { success: false, error: 'Not signed in.' }

  const role = profile.role as UserRole
  if (isMfaRequired(role) && !enabled) {
    return { success: false, error: 'SMS verification is required for your role.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ mfa_sms_enabled: enabled })
    .eq('id', user.id)

  if (error) return { success: false, error: 'Could not update MFA settings.' }

  if (!enabled) {
    await admin.from('mfa_verified_sessions').delete().eq('user_id', user.id)
  }

  return { success: true }
}
