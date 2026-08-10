import type { PageTab } from '@/components/dashboard/page-tab-shell'

/** Hash aliases → tab id for Access deep links. */
export const ACCESS_HASH_TO_TAB: Record<string, string> = {
  today: 'today',
  unlock: 'today',
  'remote-unlock': 'today',
  jobs: 'today',
  guests: 'guests',
  guest: 'guests',
  credentials: 'guests',
  staff: 'staff',
  policies: 'staff',
  attendance: 'attendance',
  setup: 'setup',
  install: 'setup',
  settings: 'setup',
}

export type AccessTabOptions = {
  openJobBadge?: number
  /** Owner: mute Setup tab when core setup is healthy. */
  setupHealthy?: boolean
}

export function accessTabsForRole(
  role: 'owner' | 'manager' | 'receptionist',
  options: AccessTabOptions | number = {},
): PageTab[] {
  const opts: AccessTabOptions =
    typeof options === 'number' ? { openJobBadge: options } : options

  const today: PageTab = {
    id: 'today',
    label: 'Today',
    badge: opts.openJobBadge && opts.openJobBadge > 0 ? opts.openJobBadge : undefined,
  }
  const guests: PageTab = { id: 'guests', label: 'Guests' }

  if (role === 'receptionist') {
    return [today, guests]
  }

  const staff: PageTab = { id: 'staff', label: 'Staff' }
  const attendance: PageTab = { id: 'attendance', label: 'Attendance' }

  if (role === 'manager') {
    return [today, guests, staff, attendance]
  }

  return [
    today,
    guests,
    staff,
    attendance,
    {
      id: 'setup',
      label: opts.setupHealthy ? 'Setup · OK' : 'Setup',
      muted: Boolean(opts.setupHealthy),
    },
  ]
}
