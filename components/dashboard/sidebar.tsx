'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeft, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getPendingComplaintApprovalsCount } from '@/app/actions/complaints'
import { SidebarLogo } from '@/components/brand/sidebar-logo'
import { PropertySwitcher } from '@/components/dashboard/property-switcher'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
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
  const [navItems, setNavItems] = useState(navigation)
  const [groups, setGroups] = useState(navGroups)

  useEffect(() => {
    setNavItems(navigation)
  }, [navigation])

  useEffect(() => {
    setGroups(navGroups)
  }, [navGroups])

  const refreshComplaintBadge = useCallback(async () => {
    const count = await getPendingComplaintApprovalsCount()
    const applyBadge = (item: NavItem) =>
      item.href.includes('complaints') ? { ...item, badge: count > 0 ? count : undefined } : item

    setNavItems((prev) => prev.map(applyBadge))
    setGroups((prev) =>
      prev?.map((group) => ({
        ...group,
        items: group.items.map(applyBadge),
      })),
    )
  }, [])

  useRealtimeRefresh('complaints', refreshComplaintBadge)
  useRealtimeRefresh('layout', refreshComplaintBadge)

  const isDrawer = mobileOpen

  function renderNavLink(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    const Icon = getNavIcon(item.icon)
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed && !isDrawer ? item.name : undefined}
        onClick={onMobileClose}
        className={`group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all ${
          collapsed && !isDrawer ? 'justify-center px-0' : 'gap-3 px-3'
        } ${isActive ? 'sidebar-nav-link--active' : 'sidebar-nav-link'}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {(!collapsed || isDrawer) && (
          <span className="flex flex-1 items-center justify-between truncate">
            <span className="truncate">{item.name}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="ml-2 rounded-md bg-[var(--brand-orange)]/90 px-2 py-0.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </span>
        )}
      </Link>
    )
  }

  const groupedNav = groups && groups.length > 0

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="sidebar-mobile-overlay fixed inset-0 z-40 bg-[var(--brand-purple-ink)]/55 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`sidebar-elevated sidebar-floating flex shrink-0 flex-col overflow-hidden transition-[transform,width,box-shadow] duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-dvh max-md:w-64 max-md:rounded-none max-md:overflow-x-hidden ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        } ${collapsed ? 'md:w-[4.5rem]' : 'md:w-64 md:translate-x-0'}`}
      >
        <div className={`shrink-0 ${collapsed ? 'px-2.5 pt-4' : 'px-4 pt-4'}`}>
          <div
            className={`mb-3 flex items-center gap-3 ${collapsed && !isDrawer ? 'justify-center' : ''}`}
            aria-label="MOJO Apartments"
          >
            <SidebarLogo />
            {(!collapsed || isDrawer) && (
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-[1.05rem] font-semibold leading-tight">
                  <span className="text-[var(--accent)]">MOJO</span>
                  <span className="text-white"> APARTMENTS</span>
                </p>
                <p className="truncate text-[10px] font-medium tracking-wide text-[var(--sidebar-muted)]">
                  Property Management
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
          <div className="mb-5">
            <PropertySwitcher collapsed={collapsed && !isDrawer} />
          </div>
        </div>

        <div className="sidebar-soft-divider mt-1" />

        <nav className="flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-3">
          {groupedNav ? (
            groups!.map((group, index) => (
              <div key={group.label} className={index > 0 ? 'mt-4' : ''}>
                {(!collapsed || isDrawer) && (
                  <p className="label-eyebrow mb-2 px-3 text-[var(--sidebar-muted)]">{group.label}</p>
                )}
                <div className="flex flex-col gap-0.5">{group.items.map(renderNavLink)}</div>
              </div>
            ))
          ) : (
            <>
              {(!collapsed || isDrawer) && (
                <p className="label-eyebrow mb-2 px-3 text-[var(--sidebar-muted)]">Menu</p>
              )}
              {navItems.map(renderNavLink)}
            </>
          )}
        </nav>

        {occupancyToday &&
          (!collapsed || isDrawer ? (
            <>
              <div className="sidebar-soft-divider" />
              <div className="p-4 pb-2">
                <div className="sidebar-glass-panel p-2.5">
                  <p className="text-[10px] font-medium text-[var(--sidebar-muted)]">
                    Occupancy today
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{occupancyToday.percent}%</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="gradient-accent h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${occupancyToday.percent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-medium text-[var(--sidebar-muted)]">
                    {occupancyToday.occupied} of {occupancyToday.total} rooms occupied
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden p-3 pb-2 md:block">
              <div
                className="sidebar-glass-panel mx-auto flex h-10 w-10 items-center justify-center text-xs font-bold text-white"
                title={`Occupancy today: ${occupancyToday.percent}% (${occupancyToday.occupied} of ${occupancyToday.total} rooms)`}
              >
                {occupancyToday.percent}%
              </div>
            </div>
          ))}

        <div className={`mt-auto hidden p-3 md:block ${collapsed ? 'px-2.5' : ''}`}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`sidebar-collapse-footer ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2'}`}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium">Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
