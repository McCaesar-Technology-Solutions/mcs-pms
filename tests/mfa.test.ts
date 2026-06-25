import { describe, expect, it } from 'vitest'
import {
  MFA_METHOD_LABELS,
  canEnrollMfa,
  mfaGateForRole,
  mfaRedirectPath,
  safeMfaNext,
  userNeedsMfa,
} from '@/lib/auth/mfa'
import { hashOtp, hashSessionKey } from '@/lib/auth/mfa-sms'

describe('userNeedsMfa', () => {
  it('applies when opted in for non-privileged roles', () => {
    expect(userNeedsMfa('technician', false)).toBe(false)
    expect(userNeedsMfa('technician', true)).toBe(true)
  })
})

describe('canEnrollMfa', () => {
  it('allows all staff roles', () => {
    expect(canEnrollMfa('technician')).toBe(true)
    expect(canEnrollMfa('owner')).toBe(true)
  })
})

describe('mfaGateForRole', () => {
  const off = {
    applies: false,
    method: null,
    hasPhone: true,
    hasEmail: true,
    hasTotp: false,
    sessionVerified: false,
  }
  const smsNeedsPhone = {
    applies: true,
    method: 'sms' as const,
    hasPhone: false,
    hasEmail: true,
    hasTotp: false,
    sessionVerified: false,
  }
  const emailNeedsAddress = {
    applies: true,
    method: 'email' as const,
    hasPhone: true,
    hasEmail: false,
    hasTotp: false,
    sessionVerified: false,
  }
  const smsNeedsVerify = {
    applies: true,
    method: 'sms' as const,
    hasPhone: true,
    hasEmail: true,
    hasTotp: false,
    sessionVerified: false,
  }
  const done = {
    applies: true,
    method: 'sms' as const,
    hasPhone: true,
    hasEmail: true,
    hasTotp: false,
    sessionVerified: true,
  }

  it('skips when MFA is off', () => {
    expect(mfaGateForRole('owner', off)).toBe('ok')
  })

  it('forces phone setup for SMS without a number', () => {
    expect(mfaGateForRole('owner', smsNeedsPhone)).toBe('enroll')
  })

  it('forces email setup when address is missing', () => {
    expect(mfaGateForRole('owner', emailNeedsAddress)).toBe('enroll')
  })

  it('forces verify when setup is complete but session is new', () => {
    expect(mfaGateForRole('manager', smsNeedsVerify)).toBe('verify')
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
        {
          applies: true,
          method: 'sms',
          hasPhone: false,
          hasEmail: true,
          hasTotp: false,
          sessionVerified: false,
        },
        '/owner/dashboard',
        '/owner/billing',
      ),
    ).toBe('/enroll-mfa?next=%2Fowner%2Fbilling')

    expect(
      mfaRedirectPath(
        'manager',
        {
          applies: true,
          method: 'sms',
          hasPhone: true,
          hasEmail: true,
          hasTotp: false,
          sessionVerified: false,
        },
        '/manager/dashboard',
      ),
    ).toBe('/verify-mfa?next=%2Fmanager%2Fdashboard')
  })
})

describe('safeMfaNext', () => {
  it('rejects open redirects and auth pages', () => {
    expect(safeMfaNext('https://evil.com', '/home')).toBe('/home')
    expect(safeMfaNext('/owner/settings', '/home')).toBe('/owner/settings')
    expect(safeMfaNext('/login', '/owner/dashboard')).toBe('/owner/dashboard')
  })
})

describe('MFA method labels', () => {
  it('includes SMS and email options', () => {
    expect(MFA_METHOD_LABELS.sms).toMatch(/SMS/i)
    expect(MFA_METHOD_LABELS.email).toMatch(/email/i)
  })
})

describe('mfa-sms hashing', () => {
  it('hashes OTP codes and session keys deterministically', async () => {
    expect(await hashOtp('123456')).toBe(await hashOtp('123456'))
    expect(await hashSessionKey('refresh-token')).toBe(await hashSessionKey('refresh-token'))
  })
})
