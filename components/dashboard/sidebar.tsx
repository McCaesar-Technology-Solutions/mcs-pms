'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Users,
  Banknote,
  Tv,
  Settings,
  FileText,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { SidebarLogo } from '@/components/brand/sidebar-logo'
import { PropertySwitcher } from '@/components/dashboard/property-switcher'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Housekeeping', href: '/housekeeping', icon: Briefcase },
  { name: 'Reservations', href: '/reservations', icon: Calendar },
  { name: 'Bookings', href: '/bookings', icon: Users },
  { name: 'Guests', href: '/guests', icon: Users },
  { name: 'Billing', href: '/billing', icon: Banknote },
  { name: 'Channels', href: '/channels', icon: Tv },
  { name: 'GRA Reports', href: '/gra-reports', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isDrawer = mobileOpen

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="sidebar-mobile-overlay fixed inset-0 z-40 bg-[#22124C]/55 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`sidebar-elevated flex h-dvh shrink-0 flex-col overflow-x-hidden transition-[transform,width] duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-64 ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        } ${collapsed ? 'md:w-[4.5rem]' : 'md:relative md:z-30 md:w-64 md:translate-x-0'}`}
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
          {(!collapsed || isDrawer) && (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--sidebar-muted)]">
              Menu
            </p>
          )}
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
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
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                {(!collapsed || isDrawer) && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {!collapsed || isDrawer ? (
          <>
            <div className="sidebar-soft-divider" />
            <div className="p-4 pb-2">
              <div className="sidebar-glass-panel p-3">
                <p className="text-xs font-semibold tracking-wide text-[var(--sidebar-muted)]">
                  Occupancy today
                </p>
                <p className="mt-1 text-2xl font-bold text-white">73%</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="gradient-accent h-full rounded-full" style={{ width: '73%' }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden p-3 pb-2 md:block">
            <div
              className="sidebar-glass-panel mx-auto flex h-10 w-10 items-center justify-center text-xs font-bold text-white"
              title="Occupancy today: 73%"
            >
              73%
            </div>
          </div>
        )}

        <div className={`mt-auto hidden p-3 md:block ${collapsed ? 'px-2.5' : ''}`}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`sidebar-collapse-footer ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2'}`}
          >
            {collapsed ? (
              <PanelLeft className="h-[1.125rem] w-[1.125rem] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-[1.125rem] w-[1.125rem] shrink-0" />
                <span className="text-xs font-medium">Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
