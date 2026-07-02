'use client'

import { SidebarNavLink } from '@/components/dashboard/sidebar-nav-link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeft, X } from 'lucide-react'
import { useState } from 'react'
import { SidebarLogo } from '@/components/brand/sidebar-logo'
import { PropertySwitcher } from '@/components/dashboard/property-switcher'
import { useNavBadges } from '@/components/dashboard/use-nav-badges'
import type { NavItem, NavGroup } from '@/lib/navigation'
import { getNavIcon } from '@/components/dashboard/nav-icons'
import type { OccupancyToday } from '@/lib/data/occupancy'

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
  navigation?: NavItem[]
  navGroups?: NavGroup[]
  occupancyToday?: OccupancyToday
}

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
  navigation = [],
  navGroups,
  occupancyToday,
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { navItems, navGroups: groups } = useNavBadges(navigation, navGroups)

  const isDrawer = mobileOpen

  function renderNavLink(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    const Icon = getNavIcon(item.icon)
    const showBadge = item.badge != null && item.badge > 0

    return (
      <SidebarNavLink
        key={item.href}
        href={item.href}
        title={collapsed && !isDrawer ? item.name : undefined}
        collapsed={collapsed && !isDrawer}
        active={isActive}
        onNavigate={onMobileClose}
      >
        <span className="sidebar-nav-link__icon">
          <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
          {showBadge && collapsed && !isDrawer && (
            <span className="sidebar-nav-link__badge-dot">
              {item.badge! > 9 ? '9+' : item.badge}
            </span>
          )}
        </span>
        {(!collapsed || isDrawer) && (
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
        className={`sidebar-elevated sidebar-floating flex min-h-0 shrink-0 flex-col overflow-hidden transition-[transform,width,box-shadow] duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-dvh max-md:w-72 max-md:rounded-none max-md:overflow-x-hidden ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        } ${collapsed ? 'md:w-[4.5rem]' : 'md:w-72 md:translate-x-0'}`}
      >
        <div className={`sidebar-header shrink-0 ${collapsed ? 'sidebar-header--collapsed' : ''}`}>
          <div
            className={`sidebar-brand-row ${collapsed && !isDrawer ? 'sidebar-brand-row--collapsed' : ''}`}
            aria-label="MOJO Apartments"
          >
            <SidebarLogo />
            {(!collapsed || isDrawer) && (
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
          <PropertySwitcher collapsed={collapsed && !isDrawer} compact />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {groupedNav ? (
            groups!.map((group, index) => (
              <div key={group.label} className={`sidebar-nav-group ${index > 0 ? 'sidebar-nav-group--spaced' : ''}`}>
                {(!collapsed || isDrawer) && (
                  <p className="sidebar-nav-eyebrow">{group.label}</p>
                )}
                <div className="sidebar-nav-group__items">{group.items.map(renderNavLink)}</div>
              </div>
            ))
          ) : (
            <div className="sidebar-nav-group">
              {(!collapsed || isDrawer) && <p className="sidebar-nav-eyebrow">Menu</p>}
              <div className="sidebar-nav-group__items">{navItems.map(renderNavLink)}</div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer shrink-0">
          {occupancyToday &&
            (!collapsed || isDrawer ? (
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
                className="sidebar-occupancy-dot hidden md:flex"
                title={`Occupancy today: ${occupancyToday.percent}% (${occupancyToday.occupied} of ${occupancyToday.total} rooms)`}
              >
                {occupancyToday.percent}%
              </div>
            ))}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`sidebar-collapse-footer hidden md:flex ${collapsed ? 'sidebar-collapse-footer--collapsed' : ''}`}
          >
            {collapsed ? (
              <PanelLeft className="h-[1.125rem] w-[1.125rem] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-[1.125rem] w-[1.125rem] shrink-0" />
                <span className="text-[0.8125rem] font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
