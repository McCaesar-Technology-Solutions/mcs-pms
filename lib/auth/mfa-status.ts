import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveLegacyMfaSessionKey,
  resolveMfaSessionKey,
} from '@/lib/auth/mfa-session-key'
import { roleRequiresMfa, userNeedsMfa, type MfaMethod, type MfaStatus } from '@/lib/auth/mfa'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import type { UserRole } from '@/types'

export interface MfaProfileFields {
  role: UserRole
  phone: string | null
  email: string | null
  mfa_enabled: boolean | null
  mfa_method: MfaMethod | null
  mfa_totp_secret: string | null
}

/** Build MFA gate state for middleware and server actions (Edge-safe). */
export async function buildMfaStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: MfaProfileFields,
): Promise<MfaStatus> {
  const enabled = profile.mfa_enabled === true
  const applies = userNeedsMfa(profile.role, enabled)
  const method = applies
    ? profile.mfa_method ?? (roleRequiresMfa(profile.role) ? null : null)
    : null
  const hasPhone = Boolean(profile.phone?.trim())
  const hasEmail = Boolean(profile.email?.trim())
  const hasTotp = Boolean(profile.mfa_totp_secret?.trim())

  let sessionVerified = false
  if (applies) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const admin = createAdminClient()
        const now = new Date().toISOString()
        const sessionKey = await resolveMfaSessionKey(session)
        const legacyKey = await resolveLegacyMfaSessionKey(session)
        const keys = [...new Set([sessionKey, legacyKey].filter(Boolean))] as string[]

        if (keys.length > 0) {
          const { data } = await admin
            .from('mfa_verified_sessions')
            .select('id')
            .eq('user_id', userId)
            .in('session_key', keys)
            .gt('expires_at', now)
            .limit(1)
          sessionVerified = Boolean(data?.[0])
        }
      }
    } catch {
      sessionVerified = false
    }
  }

  return { applies, method, hasPhone, hasEmail, hasTotp, sessionVerified }
}
