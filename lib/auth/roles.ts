import type { UserRole } from '@/types'

export const ROLE_HOME: Record<UserRole, string> = {
  owner: '/owner/dashboard',
  manager: '/manager/dashboard',
  technician: '/technician/tasks',
  receptionist: '/receptionist/dashboard',
}

export const STAFF_ROLES: UserRole[] = ['owner', 'manager', 'technician', 'receptionist']

export function isStaffRole(role: string | null | undefined): role is UserRole {
  return (
    role === 'owner' ||
    role === 'manager' ||
    role === 'technician' ||
    role === 'receptionist'
  )
}

export function roleRequiredPath(pathname: string): UserRole | 'staff' | null {
  if (pathname.startsWith('/owner')) return 'owner'
  if (pathname.startsWith('/manager')) return 'manager'
  if (pathname.startsWith('/technician')) return 'technician'
  if (pathname.startsWith('/receptionist')) return 'receptionist'
  if (pathname.startsWith('/dashboard')) return 'staff'
  return null
}
