'use client'

import Link from 'next/link'
import { ChevronDown, Camera, LogOut, MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { TechnicianRealtime } from '@/components/realtime/technician-realtime'
import { AccountPhoneDialog } from '@/components/dashboard/account-phone-dialog'
import {
  AccountProfilePhotoDialog,
  profileAvatarUrl,
} from '@/components/dashboard/account-profile-photo-dialog'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'
import { ProfilePhoneBanner } from '@/components/dashboard/profile-phone-banner'
import { PhoneContactList } from '@/components/ui/phone-contact'
import { hasPhoneNumber } from '@/lib/phone'
import type { StaffContact } from '@/lib/data/contacts'
import type { Profile } from '@/types'
import type { ReactNode } from 'react'

interface TechnicianShellProps {
  profile: Profile
  managerContacts: StaffContact[]
  children: ReactNode
}

export function TechnicianShell({ profile, managerContacts, children }: TechnicianShellProps) {
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const avatarUrl = profileAvatarUrl(profile)

  return (
    <div className="technician-portal-shell">
      {!hasPhoneNumber(profile.phone) && <ProfilePhoneBanner roleLabel="technician" />}
      <header className="technician-portal-header">
        <div className="technician-portal-header__inner">
          <div className="min-w-0 flex-1">
            <p className="technician-portal-brand">MOJO APARTMENTS</p>
            <div className="flex items-center gap-2">
              <MessengerAvatar name={profile.name} imageUrl={avatarUrl} size="xs" className="!h-8 !w-8" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[var(--tech-fg)]">{profile.name}</p>
                <p className="text-xs capitalize text-[var(--tech-fg-muted)]">
                  {profile.specialty ?? 'Technician'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/technician/messages"
              className="technician-portal-icon-btn"
              aria-label="Team messages"
            >
              <MessageCircle className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setPhotoDialogOpen(true)}
              className="technician-portal-icon-btn"
              aria-label="Profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPhoneDialogOpen(true)}
              className="technician-portal-icon-btn"
              aria-label={hasPhoneNumber(profile.phone) ? 'Update phone' : 'Add phone'}
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="technician-portal-icon-btn"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {managerContacts.length > 0 && (
          <div className="technician-portal-header__support">
            <button
              type="button"
              onClick={() => setSupportOpen((v) => !v)}
              className="technician-portal-support-toggle"
              aria-expanded={supportOpen}
            >
              <span>Call manager</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${supportOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {supportOpen && (
              <div className="technician-portal-support-panel">
                <PhoneContactList
                  contacts={managerContacts}
                  title=""
                  emptyMessage=""
                  variant="light"
                />
              </div>
            )}
          </div>
        )}
      </header>

      <main className="technician-portal-main">
        <TechnicianRealtime userId={profile.id}>{children}</TechnicianRealtime>
      </main>

      <AccountPhoneDialog
        open={phoneDialogOpen}
        onClose={() => setPhoneDialogOpen(false)}
        phone={profile.phone}
        roleLabel="technician"
      />
      <AccountProfilePhotoDialog
        open={photoDialogOpen}
        onClose={() => setPhotoDialogOpen(false)}
        profile={profile}
      />
    </div>
  )
}
