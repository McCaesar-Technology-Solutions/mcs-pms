import type { UserRole } from '@/types'

export const ROLE_HOME: Record<UserRole, string> = {
  owner: '/owner/dashboard',
  manager: '/manager/dashboard',
  technician: '/technician/tasks',
}

export const STAFF_ROLES: UserRole[] = ['owner', 'manager', 'technician']

export function isStaffRole(role: string | null | undefined): role is UserRole {
  return role === 'owner' || role === 'manager' || role === 'technician'
}

export function roleRequiredPath(pathname: string): UserRole | 'staff' | null {
  if (pathname.startsWith('/owner')) return 'owner'
  if (pathname.startsWith('/manager')) return 'manager'
  if (pathname.startsWith('/technician')) return 'technician'
  if (pathname.startsWith('/dashboard')) return 'staff'
  return null
}
