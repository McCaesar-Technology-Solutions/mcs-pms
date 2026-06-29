import {
  getDashboardPrimaryAction,
  getDashboardSearchBase,
} from '@/lib/dashboard/primary-actions'
import {
  buildStaffSearchTargets,
  buildTechnicianSearchTargets,
} from '@/lib/dashboard/search-hrefs'
import {
  managerNavigation,
  ownerNavigation,
  receptionistNavigation,
  technicianNavigation,
  type NavItem,
} from '@/lib/navigation'
import type { Profile } from '@/types'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarPlus,
  LayoutDashboard,
  LogIn,
  Search,
  Settings,
  UserCog,
} from 'lucide-react'
import { getNavIcon } from '@/components/dashboard/nav-icons'

export type CommandItemKind = 'nav' | 'action' | 'search' | 'record'

export interface CommandItem {
  id: string
  label: string
  description?: string
  href: string
  kind: CommandItemKind
  keywords?: string[]
  icon: LucideIcon
  /** Short type label shown in palette (e.g. Guest, Room) */
  meta?: string
}

function navToCommand(item: NavItem): CommandItem {
  return {
    id: `nav-${item.href}`,
    label: item.name,
    description: 'Go to page',
    href: item.href,
    kind: 'nav',
    keywords: [item.name.toLowerCase()],
    icon: getNavIcon(item.icon),
  }
}

function roleNavigation(role?: Profile['role']): NavItem[] {
  switch (role) {
    case 'owner':
      return ownerNavigation
    case 'manager':
      return managerNavigation
    case 'receptionist':
      return receptionistNavigation
    case 'technician':
      return technicianNavigation
    default:
      return []
  }
}

export function buildCommandItems(role?: Profile['role']): CommandItem[] {
  const nav = roleNavigation(role).map(navToCommand)
  const primary = getDashboardPrimaryAction(role)
  const searchBase = getDashboardSearchBase(role)
  const dashboardHref =
    role === 'owner'
      ? '/owner/dashboard'
      : role === 'manager'
        ? '/manager/dashboard'
        : role === 'receptionist'
          ? '/receptionist/dashboard'
          : role === 'technician'
            ? '/technician/tasks'
            : '/'

  const actions: CommandItem[] = []

  if (primary) {
    actions.push({
      id: 'action-primary',
      label: primary.label,
      description: 'Quick action',
      href: primary.href,
      kind: 'action',
      keywords: ['new', 'reservation', 'check', 'in', 'guest', 'book'],
      icon: primary.label.toLowerCase().includes('check') ? LogIn : CalendarPlus,
    })
  }

  actions.push({
    id: 'action-search-reservations',
    label: 'Search reservations',
    description: 'Find guests, rooms, or booking refs',
    href: searchBase,
    kind: 'search',
    keywords: ['search', 'find', 'guest', 'booking', 'room', 'ref', 'reservation'],
    icon: Search,
  })

  if (role === 'owner' || role === 'manager' || role === 'receptionist') {
    const prefix =
      role === 'owner' ? '/owner' : role === 'manager' ? '/manager' : '/receptionist'
    actions.push(
      {
        id: 'action-search-guests',
        label: 'Search guests',
        description: 'Guest directory',
        href: `${prefix}/guests`,
        kind: 'search',
        keywords: ['search', 'guest', 'directory', 'phone'],
        icon: Search,
      },
      {
        id: 'action-search-rooms',
        label: 'Search rooms',
        description: 'Room board and status',
        href: `${prefix}/rooms`,
        kind: 'search',
        keywords: ['search', 'room', 'floor', 'status'],
        icon: Search,
      },
      {
        id: 'action-search-complaints',
        label: 'Search complaints',
        description: 'Maintenance and guest issues',
        href: `${prefix}/complaints`,
        kind: 'search',
        keywords: ['search', 'complaint', 'issue', 'maintenance'],
        icon: Search,
      },
    )
  }

  if (role === 'owner') {
    actions.push({
      id: 'action-settings',
      label: 'Property settings',
      description: 'Portal, rules, and notifications',
      href: '/owner/settings',
      kind: 'action',
      keywords: ['settings', 'config', 'property'],
      icon: Settings,
    })
  }

  if (role === 'manager') {
    actions.push(
      {
        id: 'action-guest-portal',
        label: 'Guest portal settings',
        description: 'Requests, feedback, and portal copy',
        href: '/manager/dashboard#guest-portal',
        kind: 'action',
        keywords: ['guest', 'portal', 'requests', 'wifi'],
        icon: Settings,
      },
      {
        id: 'action-staff',
        label: 'Staff & account',
        description: 'Team members and your profile',
        href: '/manager/staff',
        kind: 'action',
        keywords: ['staff', 'team', 'account'],
        icon: UserCog,
      },
    )
  }

  actions.push({
    id: 'action-dashboard',
    label: 'Back to dashboard',
    description: role === 'technician' ? 'Your task list' : 'Overview and today’s ops',
    href: dashboardHref,
    kind: 'action',
    keywords: ['home', 'dashboard', 'overview', 'tasks'],
    icon: LayoutDashboard,
  })

  return [...actions, ...nav]
}

export function buildDynamicSearchItems(
  role: Profile['role'] | undefined,
  query: string,
): CommandItem[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const targets =
    role === 'technician'
      ? buildTechnicianSearchTargets(trimmed)
      : buildStaffSearchTargets(role, trimmed)

  return targets.map((target) => ({
    id: target.id,
    label: target.label,
    description: target.description,
    href: target.href,
    kind: 'search' as const,
    keywords: [trimmed.toLowerCase()],
    icon: Search,
  }))
}

export function filterCommandItems(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items

  return items.filter((item) => {
    if (item.label.toLowerCase().includes(q)) return true
    if (item.description?.toLowerCase().includes(q)) return true
    return item.keywords?.some((k) => k.includes(q) || q.includes(k))
  })
}

export function commandSearchHref(role: Profile['role'] | undefined, query: string): string {
  const base = getDashboardSearchBase(role)
  const trimmed = query.trim()
  if (!trimmed) return base
  return `${base}?q=${encodeURIComponent(trimmed)}`
}
