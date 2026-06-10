'use client'

import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { TechnicianRealtime } from '@/components/realtime/technician-realtime'
import type { Profile } from '@/types'
import type { ReactNode } from 'react'

interface TechnicianShellProps {
  profile: Profile
  children: ReactNode
}

export function TechnicianShell({ profile, children }: TechnicianShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F4FB]">
      <header className="sticky top-0 z-30 bg-white shadow-elevation-1">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-[#D4A62E]">
              MOJO APARTMENTS
            </p>
            <p className="text-sm font-medium text-[#3C216C]">{profile.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {profile.specialty ?? 'Technician'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F4FB] text-muted-foreground transition-colors hover:bg-[#3C216C]/8 hover:text-[#3C216C]"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <TechnicianRealtime userId={profile.id}>{children}</TechnicianRealtime>
    </div>
  )
}
