import { createAdminClient } from '@/lib/supabase/admin'
import { getCronSecret } from '@/lib/env'

export function authorizeCron(request: Request): boolean {
  const secret = getCronSecret()
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function cleanupRateLimits(): Promise<number> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('action_rate_limits')
    .delete()
    .lt('created_at', cutoff)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}

export async function cleanupMfaChallenges(): Promise<number> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('mfa_otp_challenges')
    .delete()
    .lt('created_at', cutoff)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}
