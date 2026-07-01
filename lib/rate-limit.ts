import { createAdminClient } from '@/lib/supabase/admin'
import { isProd } from '@/lib/env'

export interface RateLimitOptions {
  max: number
  windowMs: number
  cooldownMs?: number
}

const DEFAULT_ERROR = 'Too many attempts. Please wait a few minutes and try again.'

/**
 * DB-backed rate limit for server actions (works across serverless instances).
 * Returns an error message when limited, or null when allowed.
 * Fails closed in production when the DB check errors.
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

  if (countError) {
    console.error('[rate-limit] count error:', countError.message)
    return isProd() ? errorMessage : null
  }

  if ((count ?? 0) >= options.max) {
    return errorMessage
  }

  if (options.cooldownMs) {
    const cooldownSince = new Date(Date.now() - options.cooldownMs).toISOString()
    const { count: recentCount, error: cooldownError } = await admin
      .from('action_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('rate_key', rateKey)
      .gte('created_at', cooldownSince)

    if (cooldownError) {
      console.error('[rate-limit] cooldown error:', cooldownError.message)
      return isProd() ? errorMessage : null
    }

    if ((recentCount ?? 0) > 0) {
      return errorMessage
    }
  }

  const { error: insertError } = await admin.from('action_rate_limits').insert({ rate_key: rateKey })
  if (insertError) {
    console.error('[rate-limit] insert error:', insertError.message)
    return isProd() ? errorMessage : null
  }

  if ((count ?? 0) > 50) {
    void admin
      .from('action_rate_limits')
      .delete()
      .eq('rate_key', rateKey)
      .lt('created_at', since)
  }

  return null
}

export const GUEST_RATE_LIMITS = {
  portalEntry: { max: 20, windowMs: 15 * 60 * 1000, cooldownMs: 1_500 },
  portalEntryIp: { max: 60, windowMs: 15 * 60 * 1000, cooldownMs: 1_000 },
  magicLinkEnter: { max: 25, windowMs: 15 * 60 * 1000, cooldownMs: 500 },
  magicLinkEnterIp: { max: 80, windowMs: 15 * 60 * 1000, cooldownMs: 500 },
  complaint: { max: 10, windowMs: 60 * 60 * 1000, cooldownMs: 10_000 },
  message: { max: 60, windowMs: 15 * 60 * 1000, cooldownMs: 1_000 },
  request: { max: 20, windowMs: 60 * 60 * 1000, cooldownMs: 5_000 },
} as const satisfies Record<string, RateLimitOptions>

export const AUTH_RATE_LIMITS = {
  signIn: { max: 20, windowMs: 15 * 60 * 1000, cooldownMs: 1_000 },
  signUp: { max: 10, windowMs: 60 * 60 * 1000, cooldownMs: 5_000 },
  passwordReset: { max: 10, windowMs: 60 * 60 * 1000, cooldownMs: 15_000 },
  acceptInvite: { max: 10, windowMs: 60 * 60 * 1000, cooldownMs: 3_000 },
  mfaVerify: { max: 15, windowMs: 15 * 60 * 1000, cooldownMs: 500 },
} as const satisfies Record<string, RateLimitOptions>

export function guestRateKey(scope: string, guestId: string): string {
  return `guest:${scope}:${guestId}`
}

export function ipRateKey(scope: string, identifier: string): string {
  return `ip:${scope}:${identifier}`
}

export function authRateKey(scope: string, identifier: string): string {
  return `auth:${scope}:${identifier.toLowerCase()}`
}
