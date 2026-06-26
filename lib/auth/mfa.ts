import type { UserRole } from '@/types'
import { isProd } from '@/lib/env'

export type MfaMethod = 'sms' | 'email'

export const MFA_METHOD_LABELS: Record<MfaMethod, string> = {
  sms: 'Text message (SMS)',
  email: 'Email',
}

/** All staff may enable 2FA in profile settings; guests use the token portal only. */
export function canEnrollMfa(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist' || role === 'technician'
}

/** Owner/manager must use 2FA in production; other roles opt in via settings. */
export function roleRequiresMfa(role: UserRole): boolean {
  if (!isProd()) return false
  return role === 'owner' || role === 'manager'
}

/** Owner/manager are encouraged to enable 2FA in Settings; gate only applies once enabled. */
export function userNeedsMfa(_role: UserRole, mfaEnabled: boolean): boolean {
  return mfaEnabled
}

export const MFA_PATHS = ['/enroll-mfa', '/verify-mfa'] as const

export function mfaSettingsPathForRole(role: UserRole): string {
  if (role === 'owner') return '/owner/settings'
  if (role === 'manager' || role === 'receptionist' || role === 'technician') {
    return `/${role}/staff`
  }
  return '/login'
}

export function isMfaSettingsPath(pathname: string, role: UserRole): boolean {
  const base = mfaSettingsPathForRole(role)
  return pathname === base || pathname.startsWith(`${base}/`)
}

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
  hasEmail: boolean
  hasTotp: boolean
  sessionVerified: boolean
}

/** Decide whether the session must finish setup or verify 2FA before proceeding. */
export function mfaGateForRole(role: UserRole, status: MfaStatus): MfaGate {
  if (!status.applies) return 'ok'

  if (!status.method) return 'enroll'
  if (status.method === 'sms' && !status.hasPhone) return 'enroll'
  if (status.method === 'email' && !status.hasEmail) return 'enroll'
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
  const settingsPath = `${mfaSettingsPathForRole(role)}#security`

  if (gate === 'enroll') {
    return `${settingsPath}?next=${encodeURIComponent(next)}`
  }
  if (gate === 'verify') {
    return `${settingsPath}?next=${encodeURIComponent(next)}`
  }
  return next
}
