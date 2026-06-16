import type { UserRole } from '@/types'

/** Roles that must pass SMS verification at every sign-in. */
export const MFA_REQUIRED_ROLES: UserRole[] = ['owner', 'manager']

export function isMfaRequired(role: UserRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role)
}

/** All staff may optionally enable SMS MFA; guests use the token portal only. */
export function canEnrollMfa(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist' || role === 'technician'
}

/** Whether this account should complete SMS MFA on login. */
export function userNeedsMfa(role: UserRole, mfaSmsEnabled: boolean): boolean {
  if (isMfaRequired(role)) return true
  return mfaSmsEnabled
}

export const MFA_PATHS = ['/enroll-mfa', '/verify-mfa'] as const

/** Paths that should never be used as a post-MFA destination. */
export const MFA_BLOCKED_NEXT_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  ...MFA_PATHS,
] as const

export function isMfaPath(pathname: string): boolean {
  return MFA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isBlockedMfaNext(pathname: string): boolean {
  return MFA_BLOCKED_NEXT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Sanitize a post-MFA redirect target (same-origin relative paths only). */
export function safeMfaNext(next: string | null | undefined, fallback: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    const pathOnly = next.split('?')[0] ?? next
    if (!isBlockedMfaNext(pathOnly)) return next
  }
  return fallback
}

export type MfaGate = 'ok' | 'enroll' | 'verify'

export interface MfaStatus {
  /** This user must complete SMS MFA (required role or opted in). */
  applies: boolean
  hasPhone: boolean
  sessionVerified: boolean
}

/** Decide whether the session must add a phone or verify SMS before proceeding. */
export function mfaGateForRole(_role: UserRole, status: MfaStatus): MfaGate {
  if (!status.applies) return 'ok'
  if (!status.hasPhone) return 'enroll'
  if (!status.sessionVerified) return 'verify'
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
