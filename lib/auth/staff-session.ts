import { createClient } from '@/lib/supabase/server'
import { buildMfaStatus } from '@/lib/auth/mfa-status'
import { mfaGateForRole } from '@/lib/auth/mfa'
import type { Profile, UserRole } from '@/types'

export const MFA_ENROLL_REQUIRED_ERROR =
  'Two-factor authentication is required. Complete setup at /enroll-mfa before continuing.'
export const MFA_VERIFY_REQUIRED_ERROR =
  'Complete two-factor verification at /verify-mfa before continuing.'

let lastStaffAuthError: string | null = null

export function consumeStaffAuthError(fallback = 'Not authorized.'): string {
  const message = lastStaffAuthError ?? fallback
  lastStaffAuthError = null
  return message
}

export type VerifiedStaffResult =
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string }
      userId: string
      profile: Profile
    }
  | {
      ok: false
      error: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }

export interface VerifiedStaffOptions {
  roles?: UserRole[]
  skipMfa?: boolean
}

function profileForMfa(profile: Profile) {
  const method =
    profile.mfa_method === 'sms' || profile.mfa_method === 'email'
      ? profile.mfa_method
      : null
  return {
    role: profile.role,
    phone: profile.phone,
    email: profile.email,
    mfa_enabled: profile.mfa_enabled,
    mfa_method: method,
    mfa_totp_secret: profile.mfa_totp_secret ?? null,
  }
}

export async function requireVerifiedStaff(
  options: VerifiedStaffOptions = {},
): Promise<VerifiedStaffResult> {
  lastStaffAuthError = null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    lastStaffAuthError = 'Not signed in.'
    return { ok: false, error: lastStaffAuthError, supabase }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.is_active === false) {
    lastStaffAuthError = 'Not authorized.'
    return { ok: false, error: lastStaffAuthError, supabase }
  }

  const typedProfile = profile as Profile

  if (options.roles && !options.roles.includes(typedProfile.role)) {
    lastStaffAuthError = 'Not authorized.'
    return { ok: false, error: lastStaffAuthError, supabase }
  }

  if (!options.skipMfa) {
    const status = await buildMfaStatus(supabase, user.id, profileForMfa(typedProfile))
    const gate = mfaGateForRole(typedProfile.role, status)
    if (gate === 'enroll') {
      lastStaffAuthError = MFA_ENROLL_REQUIRED_ERROR
      return { ok: false, error: lastStaffAuthError, supabase }
    }
    if (gate === 'verify') {
      lastStaffAuthError = MFA_VERIFY_REQUIRED_ERROR
      return { ok: false, error: lastStaffAuthError, supabase }
    }
  }

  return {
    ok: true,
    supabase,
    user: { id: user.id },
    userId: user.id,
    profile: typedProfile,
  }
}

/** Returns profile or null; call consumeStaffAuthError() for the rejection reason. */
export async function loadVerifiedStaffProfile(
  options?: VerifiedStaffOptions,
): Promise<Profile | null> {
  const result = await requireVerifiedStaff(options)
  if (!result.ok) return null
  return result.profile
}
