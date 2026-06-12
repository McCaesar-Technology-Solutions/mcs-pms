'use client'

import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { TechnicianRealtime } from '@/components/realtime/technician-realtime'
import { ProfilePhoneBanner } from '@/components/dashboard/profile-phone-banner'
import { ProfilePhoneEditor } from '@/components/dashboard/profile-phone-editor'
import { PhoneContactList } from '@/components/ui/phone-contact'
import type { StaffContact } from '@/lib/data/contacts'
import type { Profile } from '@/types'
import type { ReactNode } from 'react'

interface TechnicianShellProps {
  profile: Profile
  managerContacts: StaffContact[]
  children: ReactNode
}

export function TechnicianShell({ profile, managerContacts, children }: TechnicianShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F4FB]">
      {!profile.phone && <ProfilePhoneBanner roleLabel="technician" />}
      <header className="sticky top-0 z-30 bg-white shadow-elevation-1">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center justify-between gap-3">
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F4FB] text-muted-foreground transition-colors hover:bg-[#3C216C]/8 hover:text-[#3C216C]"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          {profile.phone && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <ProfilePhoneEditor
                initialPhone={profile.phone}
                roleLabel="technician"
                variant="inline"
              />
            </div>
          )}
          {managerContacts.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <PhoneContactList
                contacts={managerContacts.slice(0, 2)}
                title="Call manager"
                variant="light"
              />
            </div>
          )}
        </div>
      </header>
      <TechnicianRealtime userId={profile.id}>{children}</TechnicianRealtime>
    </div>
  )
}
