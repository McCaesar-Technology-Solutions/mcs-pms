import { describe, expect, it, afterEach, vi } from 'vitest'
import { authRateKey, ipRateKey, guestRateKey } from '@/lib/rate-limit'

async function loadMfa() {
  vi.resetModules()
  return import('@/lib/auth/mfa')
}

async function loadEnv() {
  vi.resetModules()
  return import('@/lib/env')
}

describe('production auth policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('requires MFA for owner and manager in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { roleRequiresMfa, userNeedsMfa } = await loadMfa()
    expect(roleRequiresMfa('owner')).toBe(true)
    expect(roleRequiresMfa('manager')).toBe(true)
    expect(roleRequiresMfa('receptionist')).toBe(false)
    expect(roleRequiresMfa('technician')).toBe(false)
    expect(userNeedsMfa('owner', false)).toBe(true)
  })

  it('does not require MFA in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { roleRequiresMfa } = await loadMfa()
    expect(roleRequiresMfa('owner')).toBe(false)
  })

  it('allows public signup in production by default', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.DISABLE_PUBLIC_SIGNUP
    const { isPublicSignupAllowed } = await loadEnv()
    expect(isPublicSignupAllowed()).toBe(true)
  })

  it('blocks public signup when DISABLE_PUBLIC_SIGNUP is set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DISABLE_PUBLIC_SIGNUP', 'true')
    const { isPublicSignupAllowed } = await loadEnv()
    expect(isPublicSignupAllowed()).toBe(false)
  })

  it('allows signup in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { isPublicSignupAllowed } = await loadEnv()
    expect(isPublicSignupAllowed()).toBe(true)
  })
})

describe('rate limit key isolation', () => {
  it('normalizes auth keys to lowercase', () => {
    expect(authRateKey('signIn', 'Owner@Example.com')).toBe('auth:signIn:owner@example.com')
  })

  it('scopes guest keys per guest id', () => {
    expect(guestRateKey('complaint', 'uuid-a')).not.toBe(guestRateKey('complaint', 'uuid-b'))
  })

  it('scopes IP keys per scope', () => {
    expect(ipRateKey('portal-entry', '1.2.3.4')).toBe('ip:portal-entry:1.2.3.4')
    expect(ipRateKey('portal-entry-ip', '1.2.3.4')).not.toBe(ipRateKey('portal-entry', '1.2.3.4'))
  })
})

describe('guest session secret', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('throws in production when secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GUEST_SESSION_SECRET', '')
    const { getGuestSessionSecret } = await loadEnv()
    expect(() => getGuestSessionSecret()).toThrow(/GUEST_SESSION_SECRET/)
  })

  it('uses dev fallback outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('GUEST_SESSION_SECRET', '')
    const { getGuestSessionSecret } = await loadEnv()
    expect(getGuestSessionSecret()).toContain('dev-guest-session')
  })
})

describe('assertRateLimit fail-closed in production', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('@/lib/supabase/admin')
    vi.resetModules()
  })

  it('returns error message when DB count fails in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: null, error: { message: 'db down' } }),
            }),
          }),
          insert: async () => ({ error: null }),
          delete: () => ({
            eq: () => ({
              lt: async () => ({ error: null }),
            }),
          }),
        }),
      }),
    }))

    const { assertRateLimit } = await import('@/lib/rate-limit')
    const result = await assertRateLimit('auth:signIn:test@x.com', {
      max: 10,
      windowMs: 60_000,
    })
    expect(result).toMatch(/Too many attempts/)
  })

  it('allows request when DB succeeds under limit', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: 0, error: null }),
            }),
          }),
          insert: mockInsert,
          delete: () => ({
            eq: () => ({
              lt: async () => ({ error: null }),
            }),
          }),
        }),
      }),
    }))

    const { assertRateLimit } = await import('@/lib/rate-limit')
    const result = await assertRateLimit('auth:signIn:ok@x.com', {
      max: 10,
      windowMs: 60_000,
    })
    expect(result).toBeNull()
    expect(mockInsert).toHaveBeenCalled()
  })
})
