import type { Profile } from '@/types'

export interface DashboardPrimaryAction {
  label: string
  href: string
}

export function getDashboardPrimaryAction(role?: Profile['role']): DashboardPrimaryAction | null {
  switch (role) {
    case 'owner':
      return { label: 'New reservation', href: '/owner/reservations?checkIn=today' }
    case 'manager':
      return { label: 'New reservation', href: '/manager/reservations?checkIn=today' }
    case 'receptionist':
      return { label: 'Check in guest', href: '/receptionist/reservations?checkIn=today' }
    default:
      return null
  }
}

export function getDashboardSearchBase(role?: Profile['role']): string {
  switch (role) {
    case 'owner':
      return '/owner/reservations'
    case 'manager':
      return '/manager/reservations'
    case 'receptionist':
      return '/receptionist/reservations'
    default:
      return '/owner/reservations'
  }
}
