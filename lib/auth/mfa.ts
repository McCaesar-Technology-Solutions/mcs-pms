import type { UserRole } from '@/types'

/** Roles that must enroll TOTP before accessing the app. */
export const MFA_REQUIRED_ROLES: UserRole[] = ['owner', 'manager']

export function isMfaRequired(role: UserRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role)
}

/** All staff may optionally enroll; guests use token portal only. */
export function canEnrollMfa(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist' || role === 'technician'
}

export const MFA_PATHS = ['/enroll-mfa', '/verify-mfa'] as const

export function isMfaPath(pathname: string): boolean {
  return MFA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Sanitize a post-MFA redirect target (same-origin relative paths only). */
export function safeMfaNext(next: string | null | undefined, fallback: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return fallback
}

export type MfaGate = 'ok' | 'enroll' | 'verify'

export interface MfaStatus {
  hasVerifiedTotp: boolean
  currentLevel: 'aal1' | 'aal2' | null
  nextLevel: 'aal1' | 'aal2' | null
}

/** Decide whether the session must enroll or verify MFA before proceeding. */
export function mfaGateForRole(role: UserRole, status: MfaStatus): MfaGate {
  const required = isMfaRequired(role)
  const needsVerify =
    status.hasVerifiedTotp &&
    status.currentLevel === 'aal1' &&
    status.nextLevel === 'aal2'

  if (required && !status.hasVerifiedTotp) return 'enroll'
  if (needsVerify) return 'verify'
  return 'ok'
}

export function mfaRedirectPath(
  role: UserRole,
  status: MfaStatus,
  defaultHome: string,
  intendedPath?: string,
): string {
  const gate = mfaGateForRole(role, status)
  const next = safeMfaNext(intendedPath, defaultHome)

  if (gate === 'enroll') {
    return `/enroll-mfa?next=${encodeURIComponent(next)}`
  }
  if (gate === 'verify') {
    return `/verify-mfa?next=${encodeURIComponent(next)}`
  }
  return next
}
