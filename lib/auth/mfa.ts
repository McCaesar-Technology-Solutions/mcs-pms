import type { UserRole } from '@/types'

export type MfaMethod = 'sms' | 'totp'

export const MFA_METHOD_LABELS: Record<MfaMethod, string> = {
  sms: 'Text message (SMS)',
  totp: 'Authenticator app',
}

/** All staff may enable 2FA in profile settings; guests use the token portal only. */
export function canEnrollMfa(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist' || role === 'technician'
}

/** Whether this account should complete 2FA on login (opt-in only). */
export function userNeedsMfa(mfaEnabled: boolean): boolean {
  return mfaEnabled
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
  applies: boolean
  method: MfaMethod | null
  hasPhone: boolean
  hasTotp: boolean
  sessionVerified: boolean
}

/** Decide whether the session must finish setup or verify 2FA before proceeding. */
export function mfaGateForRole(_role: UserRole, status: MfaStatus): MfaGate {
  if (!status.applies || !status.method) return 'ok'

  if (status.method === 'sms' && !status.hasPhone) return 'enroll'
  // TOTP setup belongs in account settings — do not block sign-in for incomplete setup.
  if (status.method === 'totp' && !status.hasTotp) return 'ok'
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
