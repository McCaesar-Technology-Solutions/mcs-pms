import {
  getDashboardPrimaryAction,
  getDashboardSearchBase,
} from '@/lib/dashboard/primary-actions'
import {
  managerNavigation,
  ownerNavigation,
  receptionistNavigation,
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
} from 'lucide-react'
import { getNavIcon } from '@/components/dashboard/nav-icons'

export type CommandItemKind = 'nav' | 'action' | 'search'

export interface CommandItem {
  id: string
  label: string
  description?: string
  href: string
  kind: CommandItemKind
  keywords?: string[]
  icon: LucideIcon
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
    keywords: ['search', 'find', 'guest', 'booking', 'room', 'ref'],
    icon: Search,
  })

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

  actions.push({
    id: 'action-dashboard',
    label: 'Back to dashboard',
    description: 'Overview and today’s ops',
    href: dashboardHref,
    kind: 'action',
    keywords: ['home', 'dashboard', 'overview'],
    icon: LayoutDashboard,
  })

  return [...actions, ...nav]
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
