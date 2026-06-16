import { describe, expect, it } from 'vitest'
import {
  MFA_REQUIRED_ROLES,
  canEnrollMfa,
  isMfaRequired,
  mfaGateForRole,
  mfaRedirectPath,
  safeMfaNext,
  userNeedsMfa,
} from '@/lib/auth/mfa'
import { hashOtp, hashSessionKey } from '@/lib/auth/mfa-sms'

describe('isMfaRequired', () => {
  it('requires owner and manager only', () => {
    expect(MFA_REQUIRED_ROLES).toEqual(['owner', 'manager'])
    expect(isMfaRequired('owner')).toBe(true)
    expect(isMfaRequired('manager')).toBe(true)
    expect(isMfaRequired('receptionist')).toBe(false)
  })
})

describe('userNeedsMfa', () => {
  it('requires owner/manager always; optional roles only when opted in', () => {
    expect(userNeedsMfa('owner', false)).toBe(true)
    expect(userNeedsMfa('receptionist', false)).toBe(false)
    expect(userNeedsMfa('receptionist', true)).toBe(true)
  })
})

describe('canEnrollMfa', () => {
  it('allows all staff roles', () => {
    expect(canEnrollMfa('technician')).toBe(true)
  })
})

describe('mfaGateForRole', () => {
  const noMfa = { applies: false, hasPhone: true, sessionVerified: false }
  const needsPhone = { applies: true, hasPhone: false, sessionVerified: false }
  const needsVerify = { applies: true, hasPhone: true, sessionVerified: false }
  const done = { applies: true, hasPhone: true, sessionVerified: true }

  it('skips when MFA does not apply', () => {
    expect(mfaGateForRole('receptionist', noMfa)).toBe('ok')
  })

  it('forces phone setup when required but no phone', () => {
    expect(mfaGateForRole('owner', needsPhone)).toBe('enroll')
  })

  it('forces SMS verify when phone exists but session not verified', () => {
    expect(mfaGateForRole('manager', needsVerify)).toBe('verify')
  })

  it('allows access when session is verified', () => {
    expect(mfaGateForRole('owner', done)).toBe('ok')
  })
})

describe('mfaRedirectPath', () => {
  it('builds enroll and verify URLs with a safe next param', () => {
    expect(
      mfaRedirectPath(
        'owner',
        { applies: true, hasPhone: false, sessionVerified: false },
        '/owner/dashboard',
        '/owner/billing',
      ),
    ).toBe('/enroll-mfa?next=%2Fowner%2Fbilling')

    expect(
      mfaRedirectPath(
        'manager',
        { applies: true, hasPhone: true, sessionVerified: false },
        '/manager/dashboard',
      ),
    ).toBe('/verify-mfa?next=%2Fmanager%2Fdashboard')
  })
})

describe('safeMfaNext', () => {
  it('rejects open redirects', () => {
    expect(safeMfaNext('https://evil.com', '/home')).toBe('/home')
    expect(safeMfaNext('/owner/settings', '/home')).toBe('/owner/settings')
  })

  it('rejects auth pages as post-MFA destinations', () => {
    expect(safeMfaNext('/signup', '/owner/dashboard')).toBe('/owner/dashboard')
    expect(safeMfaNext('/login', '/owner/dashboard')).toBe('/owner/dashboard')
  })
})

describe('mfa-sms hashing', () => {
  it('hashes OTP codes and session keys deterministically', async () => {
    expect(await hashOtp('123456')).toBe(await hashOtp('123456'))
    expect(await hashSessionKey('refresh-token')).toBe(await hashSessionKey('refresh-token'))
  })
})
