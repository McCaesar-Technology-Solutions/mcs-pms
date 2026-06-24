import type { SupabaseClient } from '@supabase/supabase-js'
import { hashSessionKey } from '@/lib/auth/mfa-crypto'
import { userNeedsMfa, type MfaMethod, type MfaStatus } from '@/lib/auth/mfa'
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
  const applies = userNeedsMfa(enabled)
  const method = applies ? profile.mfa_method : null
  const hasPhone = Boolean(profile.phone?.trim())
  const hasEmail = Boolean(profile.email?.trim())
  const hasTotp = Boolean(profile.mfa_totp_secret?.trim())

  let sessionVerified = false
  if (applies) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.refresh_token) {
        const sessionKey = await hashSessionKey(session.refresh_token)
        const admin = createAdminClient()
        const { data } = await admin
          .from('mfa_verified_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('session_key', sessionKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
        sessionVerified = Boolean(data)
      }
    } catch {
      sessionVerified = false
    }
  }

  return { applies, method, hasPhone, hasEmail, hasTotp, sessionVerified }
}
