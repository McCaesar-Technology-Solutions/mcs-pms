/** Block open redirects and auth-loop targets for post-login / email-link redirects. */
const BLOCKED_RELATIVE_PATHS = ['/login', '/signup', '/enroll-mfa', '/verify-mfa'] as const

function isBlockedRelativePath(pathname: string): boolean {
  return BLOCKED_RELATIVE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Same-origin relative paths only — rejects protocol-relative URLs (`//evil.com`)
 * and off-site targets.
 */
export function safeRelativePath(
  next: string | null | undefined,
  fallback: string,
  options?: { blockAuthPaths?: boolean },
): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    const pathOnly = next.split('?')[0] ?? next
    if (options?.blockAuthPaths !== false && isBlockedRelativePath(pathOnly)) {
      return fallback
    }
    return next
  }
  return fallback
}
