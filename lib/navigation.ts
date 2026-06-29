export type NavIconKey =
  | 'layout-dashboard'
  | 'briefcase'
  | 'calendar'
  | 'users'
  | 'banknote'
  | 'file-text'
  | 'bar-chart-3'
  | 'globe'
  | 'settings'
  | 'wrench'
  | 'user-cog'
  | 'bed-double'
  | 'message-circle'
  | 'package'
  | 'receipt'

/** Serializable nav item — safe to pass from Server → Client Components */
export interface NavItem {
  name: string
  href: string
  icon: NavIconKey
  badge?: number
}

export const ownerNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/owner/dashboard', icon: 'layout-dashboard' },
  { name: 'Messages', href: '/owner/messages', icon: 'message-circle' },
  { name: 'Reservations', href: '/owner/reservations', icon: 'calendar' },
  { name: 'Guests', href: '/owner/guests', icon: 'users' },
  { name: 'Rooms', href: '/owner/rooms', icon: 'bed-double' },
  { name: 'Housekeeping', href: '/owner/housekeeping', icon: 'briefcase' },
  { name: 'Complaints', href: '/owner/complaints', icon: 'wrench' },
  { name: 'Billing', href: '/owner/billing', icon: 'banknote' },
  { name: 'Expenses', href: '/owner/expenses', icon: 'receipt' },
  { name: 'Inventory', href: '/owner/inventory', icon: 'package' },
  { name: 'GRA Reports', href: '/owner/gra-reports', icon: 'file-text' },
  { name: 'Analytics', href: '/owner/analytics', icon: 'bar-chart-3' },
  { name: 'Staff', href: '/owner/staff', icon: 'user-cog' },
  { name: 'Settings', href: '/owner/settings', icon: 'settings' },
]

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const ownerNavGroups: NavGroup[] = [
  {
    label: 'Operations',
    items: ownerNavigation.slice(0, 7),
  },
  {
    label: 'Finance & admin',
    items: ownerNavigation.slice(7),
  },
]

export const managerNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/manager/dashboard', icon: 'layout-dashboard' },
  { name: 'Messages', href: '/manager/messages', icon: 'message-circle' },
  { name: 'Reservations', href: '/manager/reservations', icon: 'calendar' },
  { name: 'Guests', href: '/manager/guests', icon: 'users' },
  { name: 'Rooms', href: '/manager/rooms', icon: 'bed-double' },
  { name: 'Housekeeping', href: '/manager/housekeeping', icon: 'briefcase' },
  { name: 'Complaints', href: '/manager/complaints', icon: 'wrench' },
  { name: 'Guest portal', href: '/manager/dashboard#guest-portal', icon: 'globe' },
  { name: 'Inventory', href: '/manager/inventory', icon: 'package' },
  { name: 'Staff', href: '/manager/staff', icon: 'user-cog' },
]

export const receptionistNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/receptionist/dashboard', icon: 'layout-dashboard' },
  { name: 'Messages', href: '/receptionist/messages', icon: 'message-circle' },
  { name: 'Reservations', href: '/receptionist/reservations', icon: 'calendar' },
  { name: 'Guests', href: '/receptionist/guests', icon: 'users' },
  { name: 'Rooms', href: '/receptionist/rooms', icon: 'bed-double' },
  { name: 'Complaints', href: '/receptionist/complaints', icon: 'wrench' },
]

export const technicianNavigation: NavItem[] = [
  { name: 'Tasks', href: '/technician/tasks', icon: 'wrench' },
  { name: 'Messages', href: '/technician/messages', icon: 'message-circle' },
]
