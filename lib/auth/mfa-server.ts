import type { SupabaseClient } from '@supabase/supabase-js'
import { ROLE_HOME } from '@/lib/auth/roles'
import {
  isMfaPath,
  mfaGateForRole,
  mfaRedirectPath,
  type MfaStatus,
} from '@/lib/auth/mfa'
import type { UserRole } from '@/types'

export async function fetchMfaStatusServer(
  supabase: SupabaseClient,
): Promise<MfaStatus> {
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])

  const verified = (factors?.totp ?? []).filter((f) => f.status === 'verified')

  return {
    hasVerifiedTotp: verified.length > 0,
    currentLevel: (aal?.currentLevel as MfaStatus['currentLevel']) ?? null,
    nextLevel: (aal?.nextLevel as MfaStatus['nextLevel']) ?? null,
  }
}

/**
 * When a staff session must enroll or verify MFA, return the redirect URL.
 * Returns null when the user may proceed to `pathname`.
 */
export async function mfaRedirectIfNeeded(
  supabase: SupabaseClient,
  role: UserRole,
  pathname: string,
  requestUrl: string,
): Promise<string | null> {
  if (isMfaPath(pathname)) return null

  const status = await fetchMfaStatusServer(supabase)
  const gate = mfaGateForRole(role, status)
  if (gate === 'ok') return null

  const home = ROLE_HOME[role]
  const target = mfaRedirectPath(role, status, home, pathname)
  const targetPath = target.split('?')[0]
  if (targetPath === pathname) return null

  return new URL(target, requestUrl).toString()
}
