import { describe, expect, it } from 'vitest'
import {
  mfaVerifiedExpiresAt,
  readSupabaseSessionId,
  resolveLegacyMfaSessionKey,
  resolveMfaSessionKey,
} from '@/lib/auth/mfa-session-key'
import { hashSessionKey } from '@/lib/auth/mfa-crypto'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('readSupabaseSessionId', () => {
  it('reads session_id from access token payload', () => {
    const token = fakeJwt({ session_id: 'abc-123', sub: 'user-1' })
    expect(readSupabaseSessionId(token)).toBe('abc-123')
  })

  it('returns null when session_id is missing', () => {
    const token = fakeJwt({ sub: 'user-1' })
    expect(readSupabaseSessionId(token)).toBeNull()
  })
})

describe('resolveMfaSessionKey', () => {
  it('prefers stable session_id over refresh token', async () => {
    const token = fakeJwt({ session_id: 'stable-session' })
    const sessionKey = await resolveMfaSessionKey({
      access_token: token,
      refresh_token: 'rotating-refresh',
    })
    expect(sessionKey).toBe(await hashSessionKey('session:stable-session'))
    expect(sessionKey).not.toBe(await hashSessionKey('rotating-refresh'))
  })

  it('falls back to refresh token when access token has no session_id', async () => {
    const token = fakeJwt({ sub: 'user-1' })
    const sessionKey = await resolveMfaSessionKey({
      access_token: token,
      refresh_token: 'legacy-refresh',
    })
    expect(sessionKey).toBe(await hashSessionKey('legacy-refresh'))
  })

  it('legacy key matches refresh token hash only', async () => {
    const legacy = await resolveLegacyMfaSessionKey({ refresh_token: 'legacy-refresh' })
    expect(legacy).toBe(await hashSessionKey('legacy-refresh'))
  })
})

describe('mfaVerifiedExpiresAt', () => {
  it('expires far beyond access token lifetime', () => {
    const expires = new Date(mfaVerifiedExpiresAt()).getTime()
    const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000
    expect(expires).toBeGreaterThan(sevenDays)
  })
})
