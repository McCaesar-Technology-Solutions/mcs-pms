import type { SupabaseClient } from '@supabase/supabase-js'
import { hashSessionKey } from '@/lib/auth/mfa-crypto'
import { userNeedsMfa, type MfaStatus } from '@/lib/auth/mfa'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import type { UserRole } from '@/types'

/** Build MFA gate state for middleware and server actions (Edge-safe). */
export async function buildMfaStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: {
    role: UserRole
    phone: string | null
    mfa_sms_enabled: boolean | null
  },
): Promise<MfaStatus> {
  const applies = userNeedsMfa(profile.role, profile.mfa_sms_enabled === true)
  const hasPhone = Boolean(profile.phone?.trim())

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

  return { applies, hasPhone, sessionVerified }
}
