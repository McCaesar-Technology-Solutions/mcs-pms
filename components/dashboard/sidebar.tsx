'use client'

import { SidebarNavLink } from '@/components/dashboard/sidebar-nav-link'
import { usePathname } from 'next/navigation'
import { ChevronDown, PanelLeftClose, PanelLeft, X } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { SidebarLogo } from '@/components/brand/sidebar-logo'
import { PropertySwitcher } from '@/components/dashboard/property-switcher'
import { useNavBadges } from '@/components/dashboard/use-nav-badges'
import type { NavItem, NavGroup } from '@/lib/navigation'
import { getNavIcon } from '@/components/dashboard/nav-icons'
import type { OccupancyToday } from '@/lib/data/occupancy'

const GROUPS_STORAGE_KEY = 'sidebar-nav-groups'
const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed'

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
  navigation?: NavItem[]
  navGroups?: NavGroup[]
  occupancyToday?: OccupancyToday
}

function groupSlug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function itemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
  navigation = [],
  navGroups,
  occupancyToday,
}: SidebarProps) {
  const pathname = usePathname() ?? ''
  const navId = useId()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const { navItems, navGroups: groups } = useNavBadges(navigation, navGroups)

  const isDrawer = mobileOpen
  const isCollapsedRail = collapsed && !isDrawer
  const showGroupToggles = !collapsed || isDrawer

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY)
      if (stored === '1') setCollapsed(true)
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, boolean>
      if (parsed && typeof parsed === 'object') {
        setOpenGroups(parsed)
      }
    } catch {
      // ignore corrupt storage
    }
  }, [])

  useEffect(() => {
    if (!groups?.length) return
    const activeGroup = groups.find((group) =>
      group.items.some((item) => itemIsActive(pathname, item.href)),
    )
    if (!activeGroup) return
    setOpenGroups((prev) => ({ ...prev, [activeGroup.label]: true }))
  }, [pathname, groups])

  const isGroupOpen = useCallback(
    (label: string) => openGroups[label] ?? true,
    [openGroups],
  )

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !(prev[label] ?? true) }
      try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore quota errors
      }
      return next
    })
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore quota errors
      }
      return next
    })
  }, [])

  function renderNavLink(item: NavItem) {
    const isActive = itemIsActive(pathname, item.href)
    const Icon = getNavIcon(item.icon)
    const showBadge = item.badge != null && item.badge > 0

    return (
      <SidebarNavLink
        key={item.href}
        href={item.href}
        title={isCollapsedRail ? item.name : undefined}
        collapsed={isCollapsedRail}
        active={isActive}
        onNavigate={onMobileClose}
      >
        <span className="sidebar-nav-link__icon">
          <Icon className="h-4 w-4" aria-hidden />
          {showBadge && isCollapsedRail && (
            <span className="sidebar-nav-link__badge-dot">
              {item.badge! > 9 ? '9+' : item.badge}
            </span>
          )}
        </span>
        {(!isCollapsedRail || isDrawer) && (
          <span className="sidebar-nav-link__text">
            <span className="truncate">{item.name}</span>
            {showBadge && (
              <span className="sidebar-nav-link__badge">
                {item.badge! > 99 ? '99+' : item.badge}
              </span>
            )}
          </span>
        )}
      </SidebarNavLink>
    )
  }

  function renderGroupToggle(label: string, itemCount: number) {
    const open = isGroupOpen(label)
    const panelId = `${navId}-${groupSlug(label)}`

    return (
      <button
        type="button"
        className="sidebar-nav-group-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => toggleGroup(label)}
      >
        <span className="sidebar-nav-group-toggle__label">{label}</span>
        <span className="sidebar-nav-group-toggle__meta">
          <span className="sidebar-nav-group-toggle__count">{itemCount}</span>
          <ChevronDown className="sidebar-nav-group-toggle__chevron" aria-hidden />
        </span>
      </button>
    )
  }

  const groupedNav = groups && groups.length > 0

  return (
    <>
      {mobileOpen && (
        <div
          role="presentation"
          className="sidebar-mobile-overlay fixed inset-0 z-40 bg-[var(--brand-purple-ink)]/55 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`sidebar-elevated sidebar-floating flex min-h-0 shrink-0 flex-col overflow-hidden transition-[transform,width,box-shadow] duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-dvh max-md:w-48 max-md:rounded-none max-md:overflow-x-hidden ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        } ${isCollapsedRail ? 'sidebar--collapsed' : 'md:w-48 md:translate-x-0'}`}
      >
        <div className={`sidebar-header shrink-0 ${isCollapsedRail ? 'sidebar-header--collapsed' : ''}`}>
          <div
            className={`sidebar-brand-row ${isCollapsedRail ? 'sidebar-brand-row--collapsed' : ''}`}
            aria-label="MOJO Apartments"
          >
            <SidebarLogo compact={isCollapsedRail} />
            {(!isCollapsedRail || isDrawer) && (
              <div className="min-w-0 flex-1">
                <p className="sidebar-brand-title">
                  <span className="text-[var(--accent)]">MOJO</span>
                  <span className="text-white"> APARTMENTS</span>
                </p>
              </div>
            )}
            {isDrawer && (
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-[var(--sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white md:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <PropertySwitcher collapsed={isCollapsedRail} compact />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {groupedNav ? (
            groups!.map((group, index) => {
              const open = isGroupOpen(group.label)
              const panelId = `${navId}-${groupSlug(group.label)}`

              return (
                <div
                  key={group.label}
                  className={`sidebar-nav-group ${
                    index > 0
                      ? isCollapsedRail
                        ? 'sidebar-nav-group--divided'
                        : 'sidebar-nav-group--spaced'
                      : ''
                  }${open ? '' : ' sidebar-nav-group--closed'}`}
                >
                  {showGroupToggles && renderGroupToggle(group.label, group.items.length)}
                  <div
                    id={panelId}
                    className={`sidebar-nav-group__items${open || !showGroupToggles ? '' : ' sidebar-nav-group__items--closed'}`}
                    hidden={showGroupToggles ? !open : false}
                  >
                    {group.items.map(renderNavLink)}
                  </div>
                </div>
              )
            })
          ) : (
            <div className={`sidebar-nav-group${isGroupOpen('Menu') ? '' : ' sidebar-nav-group--closed'}`}>
              {showGroupToggles && renderGroupToggle('Menu', navItems.length)}
              <div
                id={`${navId}-menu`}
                className={`sidebar-nav-group__items${isGroupOpen('Menu') || !showGroupToggles ? '' : ' sidebar-nav-group__items--closed'}`}
                hidden={showGroupToggles ? !isGroupOpen('Menu') : false}
              >
                {navItems.map(renderNavLink)}
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer shrink-0">
          {occupancyToday &&
            (!isCollapsedRail || isDrawer ? (
              <div className="sidebar-occupancy-strip" title={`${occupancyToday.occupied} of ${occupancyToday.total} rooms occupied`}>
                <span className="sidebar-occupancy-strip__label">Occ.</span>
                <span className="sidebar-occupancy-strip__value">{occupancyToday.percent}%</span>
                <div className="sidebar-occupancy-strip__bar" aria-hidden>
                  <div
                    className="sidebar-occupancy-strip__fill"
                    style={{ width: `${occupancyToday.percent}%` }}
                  />
                </div>
                <span className="sidebar-occupancy-strip__meta">
                  {occupancyToday.occupied}/{occupancyToday.total}
                </span>
              </div>
            ) : (
              <div
                className="sidebar-occupancy-dot"
                title={`Occupancy today: ${occupancyToday.percent}% (${occupancyToday.occupied} of ${occupancyToday.total} rooms)`}
              >
                <span className="sidebar-occupancy-dot__value">{occupancyToday.percent}</span>
              </div>
            ))}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`sidebar-collapse-footer hidden md:flex ${isCollapsedRail ? 'sidebar-collapse-footer--collapsed' : ''}`}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
