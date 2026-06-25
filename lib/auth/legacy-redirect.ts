import { ROLE_HOME } from '@/lib/auth/roles'
import type { UserRole } from '@/types'

const PATH_MAP: Record<string, Partial<Record<UserRole, string>>> = {
  '/reservations': { owner: '/owner/reservations', manager: '/manager/reservations' },
  '/bookings': { owner: '/owner/reservations', manager: '/manager/reservations' },
  '/guests': { manager: '/manager/guests' },
  '/housekeeping': { owner: '/owner/housekeeping', manager: '/manager/housekeeping' },
  '/billing': { owner: '/owner/billing' },
  '/gra-reports': { owner: '/owner/gra-reports' },
  '/analytics': { owner: '/owner/analytics' },
  '/settings': { owner: '/owner/settings' },
  '/channels': { owner: '/owner/channels' },
}

/** Map legacy top-level paths to role-scoped routes. */
export function legacyPathForRole(pathname: string, role: UserRole): string {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (role === 'owner') return pathname.replace(/^\/dashboard/, '/owner/dashboard')
    if (role === 'manager') return pathname.replace(/^\/dashboard/, '/manager/dashboard')
    return ROLE_HOME.technician
  }

  const mapped = PATH_MAP[pathname]?.[role]
  if (mapped) return mapped

  return ROLE_HOME[role]
}
