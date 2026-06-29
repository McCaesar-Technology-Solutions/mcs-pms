'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, MessageCircle, Search } from 'lucide-react'
import { CommandPaletteProvider, useCommandPaletteOptional } from '@/components/dashboard/command-palette'
import type { Profile } from '@/types'
import type { ReactNode } from 'react'

function TechnicianBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="technician-bottom-nav" aria-label="Technician navigation">
      <Link
        href="/technician/tasks"
        className={`technician-bottom-nav__item ${pathname.startsWith('/technician/tasks') ? 'technician-bottom-nav__item--active' : ''}`}
      >
        <ClipboardList className="h-5 w-5" aria-hidden />
        Tasks
      </Link>
      <Link
        href="/technician/messages"
        className={`technician-bottom-nav__item ${pathname.startsWith('/technician/messages') ? 'technician-bottom-nav__item--active' : ''}`}
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        Messages
      </Link>
    </nav>
  )
}

function TechnicianSearchButton() {
  const palette = useCommandPaletteOptional()
  if (!palette) return null

  return (
    <button
      type="button"
      onClick={() => palette.setOpen(true)}
      className="technician-portal-icon-btn"
      aria-label="Search tasks and pages"
    >
      <Search className="h-4 w-4" />
    </button>
  )
}

interface TechnicianWayfindingProps {
  profile: Profile
  children: ReactNode
  headerExtras?: ReactNode
}

/** Wraps technician pages with command palette + mobile bottom nav. */
export function TechnicianWayfinding({ profile, children, headerExtras }: TechnicianWayfindingProps) {
  return (
    <CommandPaletteProvider profile={profile}>
      {headerExtras}
      {children}
      <TechnicianBottomNav />
    </CommandPaletteProvider>
  )
}

export { TechnicianSearchButton, TechnicianBottomNav }
