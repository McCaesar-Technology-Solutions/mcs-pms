'use client'

import { createClient } from '@/lib/supabase/client'
import { mfaRedirectPath, type MfaStatus } from '@/lib/auth/mfa'
import type { UserRole } from '@/types'

export async function fetchMfaStatus(): Promise<MfaStatus> {
  const supabase = createClient()
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

/** After password sign-in, route to MFA enroll/verify or the role home. */
export async function resolvePostLoginPath(
  role: UserRole,
  defaultHome: string,
): Promise<string> {
  const status = await fetchMfaStatus()
  return mfaRedirectPath(role, status, defaultHome, defaultHome)
}
