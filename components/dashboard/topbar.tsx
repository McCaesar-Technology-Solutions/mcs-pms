'use client'

import Link from 'next/link'
import { ChevronDown, LogOut, Menu, Phone, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  NotificationsMenu,
  settingsHref,
  settingsMenuLabel,
} from '@/components/dashboard/notifications-menu'
import { HeaderDropdownPanel } from '@/components/dashboard/header-dropdown-panel'
import { AccountPhoneDialog } from '@/components/dashboard/account-phone-dialog'
import { TopbarSearch } from '@/components/dashboard/topbar-search'
import { signOut } from '@/app/actions/auth'
import { getDashboardPrimaryAction } from '@/lib/dashboard/primary-actions'
import { hasPhoneNumber } from '@/lib/phone'
import type { Profile } from '@/types'

interface TopbarProps {
  onMenuOpen?: () => void
  profile?: Profile | null
}

function roleLabel(role?: Profile['role']): string {
  if (role === 'owner') return 'property owner'
  if (role === 'manager') return 'manager'
  return 'team member'
}

function shortPrimaryLabel(label: string): string {
  if (label === 'Check in guest') return 'Check in'
  if (label === 'New reservation') return 'New booking'
  return label
}

export default function Topbar({ onMenuOpen, profile }: TopbarProps) {
  const user = profile
    ? { name: profile.name, email: profile.email }
    : { name: 'User', email: '' }
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const userTriggerRef = useRef<HTMLButtonElement>(null)
  const canManagePhone = profile?.role === 'owner' || profile?.role === 'manager'
  const primaryAction = getDashboardPrimaryAction(profile?.role)

  useEffect(() => {
    const main = document.querySelector('main.app-main')
    if (!main) return

    const onScroll = () => {
      setScrolled(main.scrollTop > 8)
    }

    onScroll()
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className="app-topbar-slot">
        <header
          className={`main-header topbar-floating ${scrolled ? 'topbar-floating--scrolled' : ''}`}
        >
          <div className="relative z-[1] flex h-[3.25rem] items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4 md:px-5">
          <button
            type="button"
            onClick={onMenuOpen}
            aria-label="Open navigation menu"
            className="topbar-icon-btn topbar-mobile-menu-btn shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>

          <TopbarSearch profile={profile} />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            {primaryAction && (
              <Link
                href={primaryAction.href}
                title={primaryAction.label}
                aria-label={primaryAction.label}
                className="topbar-primary-action topbar-primary-action--icon-only hidden sm:inline-flex"
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="hidden lg:inline xl:hidden">{shortPrimaryLabel(primaryAction.label)}</span>
                <span className="hidden xl:inline">{primaryAction.label}</span>
              </Link>
            )}
            {canManagePhone && !hasPhoneNumber(profile?.phone) && (
              <button
                type="button"
                onClick={() => setPhoneDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-200"
              >
                <Phone className="h-3.5 w-3.5" />
                Add phone
              </button>
            )}

            <NotificationsMenu profile={profile} />

            <div className="relative">
              <button
                ref={userTriggerRef}
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
                className="main-header-user flex items-center gap-2 rounded-xl px-2 py-1 transition-colors sm:px-2.5 md:px-3"
              >
                <div className="gradient-primary flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white">
                  {user.name.charAt(0)}
                </div>
                <span className="main-header-user-name hidden text-sm font-medium sm:inline">
                  {user.name}
                </span>
                <ChevronDown className="main-header-icon hidden h-4 w-4 sm:block" />
              </button>

              <HeaderDropdownPanel
                open={showUserMenu}
                anchorRef={userTriggerRef}
                onClose={() => setShowUserMenu(false)}
                width={224}
                className="modal-panel surface-card overflow-hidden rounded-xl border border-[rgba(var(--glow-purple),0.1)] bg-white py-1 shadow-elevation-3"
              >
                <div className="surface-card-header px-4 py-3">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="modal-panel-subtle text-xs">{user.email}</p>
                  {canManagePhone && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Phone:{' '}
                      <span className="font-medium text-foreground">
                        {hasPhoneNumber(profile?.phone) ? profile?.phone : 'Not set'}
                      </span>
                    </p>
                  )}
                </div>
                {canManagePhone && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false)
                      setPhoneDialogOpen(true)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <Phone className="h-4 w-4" />
                    {hasPhoneNumber(profile?.phone) ? 'Edit phone number' : 'Add phone number'}
                  </button>
                )}
                <Link
                  href={settingsHref(profile?.role)}
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                >
                  {settingsMenuLabel(profile?.role)}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-secondary/60"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </HeaderDropdownPanel>
            </div>
          </div>
          </div>
        </header>
      </div>

      {canManagePhone && (
        <AccountPhoneDialog
          open={phoneDialogOpen}
          onClose={() => setPhoneDialogOpen(false)}
          phone={profile?.phone}
          roleLabel={roleLabel(profile?.role)}
        />
      )}
    </>
  )
}
