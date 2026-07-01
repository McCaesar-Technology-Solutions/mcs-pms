'use client'

import { Search } from 'lucide-react'
import { CommandPaletteProvider, useCommandPaletteOptional } from '@/components/dashboard/command-palette'
import { TechnicianBottomNav } from '@/components/technician/technician-bottom-nav'
import type { Profile } from '@/types'
import type { ReactNode } from 'react'

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
