import { hashSessionKey } from '@/lib/auth/mfa-crypto'

/** Supabase session fields needed to resolve MFA verification binding. */
export interface MfaAuthSession {
  access_token?: string
  refresh_token?: string
  expires_at?: number
}

const SESSION_ID_PREFIX = 'session:'

/** MFA verification lasts for the login session, not the short-lived access token. */
const MFA_VERIFIED_TTL_MS = 30 * 24 * 60 * 60 * 1000

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function readSupabaseSessionId(accessToken: string | undefined): string | null {
  if (!accessToken?.trim()) return null
  const payload = decodeJwtPayload(accessToken)
  const sessionId = payload?.session_id
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null
}

/**
 * Stable key for mfa_verified_sessions — uses JWT session_id when present so
 * refresh-token rotation does not invalidate MFA verification.
 */
export async function resolveMfaSessionKey(session: MfaAuthSession): Promise<string | null> {
  const sessionId = readSupabaseSessionId(session.access_token)
  if (sessionId) {
    return hashSessionKey(`${SESSION_ID_PREFIX}${sessionId}`)
  }
  if (session.refresh_token?.trim()) {
    return hashSessionKey(session.refresh_token)
  }
  return null
}

/** Optional legacy lookup key (refresh token hash) for rows created before session_id binding. */
export async function resolveLegacyMfaSessionKey(
  session: MfaAuthSession,
): Promise<string | null> {
  if (!session.refresh_token?.trim()) return null
  return hashSessionKey(session.refresh_token)
}

export function mfaVerifiedExpiresAt(): string {
  return new Date(Date.now() + MFA_VERIFIED_TTL_MS).toISOString()
}
