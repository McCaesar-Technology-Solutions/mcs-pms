'use client'

import { getStaffMfaRedirect } from '@/app/actions/mfa'
import type { UserRole } from '@/types'

/** After password sign-in, route to SMS MFA enroll/verify or the role home. */
export async function resolvePostLoginPath(
  _role: UserRole,
  defaultHome: string,
): Promise<string> {
  return getStaffMfaRedirect(defaultHome)
}
