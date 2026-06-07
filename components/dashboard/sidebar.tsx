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
      className={`sidebar-elevated relative z-30 flex h-screen shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      <div className={`shrink-0 ${collapsed ? 'px-2.5 pt-4' : 'px-4 pt-4'}`}>
        <div
          className={`mb-3 flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="gradient-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-elevation-2">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">Abɔfa PMS</p>
              <p className="truncate text-[10px] font-medium text-[var(--sidebar-muted)]">
                Property Management
              </p>
            </div>
          )}
        </div>
        <PropertySwitcher collapsed={collapsed} />
      </div>

      <div className="sidebar-soft-divider" />

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
            <div className="rounded-xl bg-white/10 p-3 shadow-elevation-1">
              <p className="text-xs font-semibold text-[var(--sidebar-muted)] tracking-wide">
                Occupancy today
              </p>
              <p className="mt-1 text-2xl font-bold text-white">73%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
                <div className="gradient-primary h-full rounded-full" style={{ width: '73%' }} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-3 pb-2">
          <div
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white shadow-elevation-1"
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
