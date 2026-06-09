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

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`sidebar-elevated relative z-30 flex h-screen shrink-0 flex-col overflow-x-hidden transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      <div className={`shrink-0 ${collapsed ? 'px-2.5 pt-4' : 'px-4 pt-4'}`}>
        <div
          className={`mb-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}
          aria-label="MOJO Apartments"
        >
          <SidebarLogo />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display truncate text-[1.05rem] font-semibold leading-tight">
                <span className="text-[var(--accent)]">MOJO</span>
                <span className="text-white"> APARTMENTS</span>
              </p>
              <p className="truncate text-[10px] font-medium tracking-wide text-[var(--sidebar-muted)]">
                Property Management
              </p>
            </div>
          )}
        </div>
        <div className="mb-5">
          <PropertySwitcher collapsed={collapsed} />
        </div>
      </div>

      <div className="sidebar-soft-divider mt-1" />

      <nav className="flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-3">
        {!collapsed && (
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
              title={collapsed ? item.name : undefined}
              className={`group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${isActive ? 'sidebar-nav-link--active' : 'sidebar-nav-link'}`}
            >
              <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {!collapsed ? (
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
        <div className="p-3 pb-2">
          <div
            className="sidebar-glass-panel mx-auto flex h-10 w-10 items-center justify-center text-xs font-bold text-white"
            title="Occupancy today: 73%"
          >
            73%
          </div>
        </div>
      )}

      <div className={`mt-auto p-3 ${collapsed ? 'px-2.5' : ''}`}>
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
  )
}
