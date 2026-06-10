export type NavIconKey =
  | 'layout-dashboard'
  | 'briefcase'
  | 'calendar'
  | 'users'
  | 'banknote'
  | 'file-text'
  | 'bar-chart-3'
  | 'settings'
  | 'wrench'
  | 'user-cog'
  | 'bed-double'

/** Serializable nav item — safe to pass from Server → Client Components */
export interface NavItem {
  name: string
  href: string
  icon: NavIconKey
  badge?: number
}

export const ownerNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/owner/dashboard', icon: 'layout-dashboard' },
  { name: 'Rooms', href: '/owner/rooms', icon: 'bed-double' },
  { name: 'Reservations', href: '/owner/reservations', icon: 'calendar' },
  { name: 'Staff', href: '/owner/staff', icon: 'user-cog' },
  { name: 'Billing', href: '/owner/billing', icon: 'banknote' },
  { name: 'GRA Reports', href: '/owner/gra-reports', icon: 'file-text' },
  { name: 'Analytics', href: '/owner/analytics', icon: 'bar-chart-3' },
  { name: 'Settings', href: '/owner/settings', icon: 'settings' },
]

export const managerNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/manager/dashboard', icon: 'layout-dashboard' },
  { name: 'Rooms', href: '/manager/rooms', icon: 'bed-double' },
  { name: 'Guests', href: '/manager/guests', icon: 'users' },
  { name: 'Reservations', href: '/manager/reservations', icon: 'calendar' },
  { name: 'Complaints', href: '/manager/complaints', icon: 'wrench' },
  { name: 'Housekeeping', href: '/manager/housekeeping', icon: 'briefcase' },
  { name: 'Staff', href: '/manager/staff', icon: 'user-cog' },
]
