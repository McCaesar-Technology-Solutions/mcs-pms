'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
import { PortalBrand } from '@/components/brand/portal-brand'
import { CommandPaletteProvider } from '@/components/dashboard/command-palette'
import { TechnicianBottomNav, TechnicianSearchButton } from '@/components/technician/technician-wayfinding'
import { useMessagesNavBadge } from '@/components/staff-messages/use-messages-nav-badge'
import Image from 'next/image'
import { hasPhoneNumber } from '@/lib/phone'
import type { StaffContact } from '@/lib/data/contacts'
import type { Profile } from '@/types'
import type { ReactNode } from 'react'

interface TechnicianShellProps {
  profile: Profile
  managerContacts: StaffContact[]
  propertyName: string
  propertyImageUrl?: string | null
  children: ReactNode
}

export function TechnicianShell({
  profile,
  managerContacts,
  propertyName,
  propertyImageUrl = null,
  children,
}: TechnicianShellProps) {
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const avatarUrl = profileAvatarUrl(profile)
  const pathname = usePathname()
  const onMessages = pathname.startsWith('/technician/messages')
  const unreadMessages = useMessagesNavBadge('/technician/messages')

  return (
    <TechnicianRealtime userId={profile.id}>
    <CommandPaletteProvider profile={profile}>
    <div className="technician-portal-shell technician-portal-shell--with-nav">
      {!hasPhoneNumber(profile.phone) && <ProfilePhoneBanner roleLabel="technician" />}
      <header className="technician-portal-header">
        <div className="technician-portal-header__inner">
          <div className="min-w-0 flex-1 space-y-3">
            <PortalBrand variant="technician" />
            <div className="flex items-center gap-3">
              {propertyImageUrl ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--tech-border)]">
                  <Image src={propertyImageUrl} alt={propertyName} fill className="object-cover" sizes="40px" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tech-accent-softer)] text-sm font-bold text-[var(--brand-purple)] ring-1 ring-[var(--tech-border)]">
                  {propertyName.charAt(0)}
                </div>
              )}
              <p className="truncate text-sm font-semibold text-[var(--tech-fg)]">{propertyName}</p>
            </div>
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
            <TechnicianSearchButton />
            <Link
              href="/technician/messages"
              className={`technician-portal-icon-btn relative hidden md:inline-flex ${onMessages ? 'technician-portal-icon-btn--active' : ''}`}
              aria-label={
                unreadMessages > 0
                  ? `Team messages, ${unreadMessages} unread`
                  : 'Team messages'
              }
            >
              <MessageCircle className="h-4 w-4" />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-primary px-0.5 text-[9px] font-bold tabular-nums text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
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

      <main className="technician-portal-main">{children}</main>

      <TechnicianBottomNav />

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
    </CommandPaletteProvider>
    </TechnicianRealtime>
  )
}
