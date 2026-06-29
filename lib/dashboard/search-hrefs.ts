import type { Profile } from '@/types'

export type StaffRoutePrefix = '/owner' | '/manager' | '/receptionist'

export function staffRoutePrefix(role?: Profile['role']): StaffRoutePrefix {
  if (role === 'manager') return '/manager'
  if (role === 'receptionist') return '/receptionist'
  return '/owner'
}

export interface StaffSearchTarget {
  id: string
  label: string
  description: string
  href: string
}

export function buildStaffSearchTargets(
  role: Profile['role'] | undefined,
  query: string,
): StaffSearchTarget[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const q = encodeURIComponent(trimmed)
  const prefix = staffRoutePrefix(role)

  const targets: StaffSearchTarget[] = [
    {
      id: 'search-reservations',
      label: `Search reservations for “${trimmed}”`,
      description: 'Guests, rooms, or booking refs',
      href: `${prefix}/reservations?q=${q}`,
    },
    {
      id: 'search-guests',
      label: `Search guests for “${trimmed}”`,
      description: 'Guest directory',
      href: `${prefix}/guests?q=${q}`,
    },
    {
      id: 'search-rooms',
      label: `Search rooms for “${trimmed}”`,
      description: 'Room board and status',
      href: `${prefix}/rooms?q=${q}`,
    },
    {
      id: 'search-complaints',
      label: `Search complaints for “${trimmed}”`,
      description: 'Maintenance and guest issues',
      href: `${prefix}/complaints?q=${q}`,
    },
  ]

  if (role === 'owner' || role === 'manager') {
    targets.push({
      id: 'search-housekeeping',
      label: `Search housekeeping for “${trimmed}”`,
      description: 'Tasks and room cleans',
      href: `${prefix}/housekeeping?q=${q}`,
    })
  }

  return targets
}

export function buildTechnicianSearchTargets(query: string): StaffSearchTarget[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const q = encodeURIComponent(trimmed)
  return [
    {
      id: 'search-tasks',
      label: `Search tasks for “${trimmed}”`,
      description: 'Maintenance and housekeeping jobs',
      href: `/technician/tasks?q=${q}`,
    },
  ]
}
