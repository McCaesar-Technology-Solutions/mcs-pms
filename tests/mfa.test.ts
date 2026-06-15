import { describe, expect, it } from 'vitest'
import {
  MFA_REQUIRED_ROLES,
  canEnrollMfa,
  isMfaRequired,
  mfaGateForRole,
  mfaRedirectPath,
  safeMfaNext,
} from '@/lib/auth/mfa'

describe('isMfaRequired', () => {
  it('requires owner and manager only', () => {
    expect(MFA_REQUIRED_ROLES).toEqual(['owner', 'manager'])
    expect(isMfaRequired('owner')).toBe(true)
    expect(isMfaRequired('manager')).toBe(true)
    expect(isMfaRequired('receptionist')).toBe(false)
    expect(isMfaRequired('technician')).toBe(false)
  })
})

describe('canEnrollMfa', () => {
  it('allows all staff roles', () => {
    expect(canEnrollMfa('owner')).toBe(true)
    expect(canEnrollMfa('receptionist')).toBe(true)
    expect(canEnrollMfa('technician')).toBe(true)
  })
})

describe('mfaGateForRole', () => {
  const aal1Only = { hasVerifiedTotp: false, currentLevel: 'aal1' as const, nextLevel: 'aal2' as const }
  const enrolledAal1 = { hasVerifiedTotp: true, currentLevel: 'aal1' as const, nextLevel: 'aal2' as const }
  const enrolledAal2 = { hasVerifiedTotp: true, currentLevel: 'aal2' as const, nextLevel: 'aal2' as const }

  it('forces enroll for required roles without TOTP', () => {
    expect(mfaGateForRole('owner', aal1Only)).toBe('enroll')
    expect(mfaGateForRole('manager', aal1Only)).toBe('enroll')
  })

  it('does not force enroll for optional roles without TOTP', () => {
    expect(mfaGateForRole('receptionist', aal1Only)).toBe('ok')
  })

  it('requires verify when TOTP enrolled but session is AAL1', () => {
    expect(mfaGateForRole('owner', enrolledAal1)).toBe('verify')
    expect(mfaGateForRole('technician', enrolledAal1)).toBe('verify')
  })

  it('allows access at AAL2', () => {
    expect(mfaGateForRole('owner', enrolledAal2)).toBe('ok')
  })
})

describe('mfaRedirectPath', () => {
  it('builds enroll and verify URLs with a safe next param', () => {
    expect(
      mfaRedirectPath(
        'owner',
        { hasVerifiedTotp: false, currentLevel: 'aal1', nextLevel: 'aal2' },
        '/owner/dashboard',
        '/owner/billing',
      ),
    ).toBe('/enroll-mfa?next=%2Fowner%2Fbilling')

    expect(
      mfaRedirectPath(
        'manager',
        { hasVerifiedTotp: true, currentLevel: 'aal1', nextLevel: 'aal2' },
        '/manager/dashboard',
      ),
    ).toBe('/verify-mfa?next=%2Fmanager%2Fdashboard')
  })
})

describe('safeMfaNext', () => {
  it('rejects open redirects', () => {
    expect(safeMfaNext('https://evil.com', '/home')).toBe('/home')
    expect(safeMfaNext('//evil.com', '/home')).toBe('/home')
    expect(safeMfaNext('/owner/settings', '/home')).toBe('/owner/settings')
  })
})
