import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitOptions {
  /** Max attempts within the sliding window. */
  max: number
  /** Window length in milliseconds. */
  windowMs: number
  /** Minimum gap between consecutive attempts (optional). */
  cooldownMs?: number
}

const DEFAULT_ERROR = 'Too many attempts. Please wait a few minutes and try again.'

/**
 * DB-backed rate limit for server actions (works across serverless instances).
 * Returns an error message when limited, or null when allowed.
 */
export async function assertRateLimit(
  rateKey: string,
  options: RateLimitOptions,
  errorMessage = DEFAULT_ERROR,
): Promise<string | null> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - options.windowMs).toISOString()

  const { count, error: countError } = await admin
    .from('action_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('rate_key', rateKey)
    .gte('created_at', since)

  if (countError) return null

  if ((count ?? 0) >= options.max) {
    return errorMessage
  }

  if (options.cooldownMs) {
    const cooldownSince = new Date(Date.now() - options.cooldownMs).toISOString()
    const { count: recentCount } = await admin
      .from('action_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('rate_key', rateKey)
      .gte('created_at', cooldownSince)

    if ((recentCount ?? 0) > 0) {
      return errorMessage
    }
  }

  await admin.from('action_rate_limits').insert({ rate_key: rateKey })

  if ((count ?? 0) > 50) {
    void admin
      .from('action_rate_limits')
      .delete()
      .eq('rate_key', rateKey)
      .lt('created_at', since)
  }

  return null
}

/** Common presets for guest-facing actions. */
export const GUEST_RATE_LIMITS = {
  portalEntry: { max: 8, windowMs: 15 * 60 * 1000, cooldownMs: 5_000 },
  complaint: { max: 5, windowMs: 60 * 60 * 1000, cooldownMs: 30_000 },
  message: { max: 30, windowMs: 15 * 60 * 1000, cooldownMs: 2_000 },
  request: { max: 10, windowMs: 60 * 60 * 1000, cooldownMs: 10_000 },
  preArrival: { max: 5, windowMs: 60 * 60 * 1000, cooldownMs: 10_000 },
} as const satisfies Record<string, RateLimitOptions>

export function guestRateKey(scope: string, guestId: string): string {
  return `guest:${scope}:${guestId}`
}

export function ipRateKey(scope: string, identifier: string): string {
  return `ip:${scope}:${identifier}`
}
