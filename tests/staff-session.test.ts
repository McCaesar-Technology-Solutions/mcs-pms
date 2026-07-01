import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mfaGateForRole } from '@/lib/auth/mfa'
import * as env from '@/lib/env'

describe('mfaGateForRole production owner', () => {
  beforeEach(() => {
    vi.spyOn(env, 'isProd').mockReturnValue(true)
  })

  it('forces enroll when owner has not set up 2FA', () => {
    expect(
      mfaGateForRole('owner', {
        applies: true,
        method: null,
        hasPhone: true,
        hasEmail: true,
        hasTotp: false,
        sessionVerified: false,
      }),
    ).toBe('enroll')
  })
})
