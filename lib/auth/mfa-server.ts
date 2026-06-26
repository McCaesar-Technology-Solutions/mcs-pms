import type { SupabaseClient } from '@supabase/supabase-js'
import { buildMfaStatus } from '@/lib/auth/mfa-status'
import { ROLE_HOME } from '@/lib/auth/roles'
import {
  isMfaPath,
  isMfaSettingsPath,
  mfaGateForRole,
  mfaRedirectPath,
  mfaSettingsPathForRole,
  safeMfaNext,
} from '@/lib/auth/mfa'
import type { UserRole } from '@/types'

interface StaffMfaProfile {
  role: UserRole
  phone: string | null
  email: string | null
  mfa_enabled: boolean | null
  mfa_method: import('@/lib/auth/mfa').MfaMethod | null
  mfa_totp_secret: string | null
}

/**
 * When a staff session must add a phone or verify SMS, return the redirect URL.
 * Returns null when the user may proceed to `pathname`.
 */
export async function mfaRedirectIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  profile: StaffMfaProfile,
  pathname: string,
  requestUrl: string,
): Promise<string | null> {
  if (isMfaPath(pathname)) return null
  if (isMfaSettingsPath(pathname, profile.role)) return null

  const status = await buildMfaStatus(supabase, userId, profile)
  const gate = mfaGateForRole(profile.role, status)
  if (gate === 'ok') return null

  const home = ROLE_HOME[profile.role]
  const intended = safeMfaNext(pathname, home)
  const target = mfaRedirectPath(profile.role, status, home, intended)
  const targetPath = target.split('?')[0]?.split('#')[0] ?? target
  if (targetPath === pathname) return null

  return new URL(target, requestUrl).toString()
}
