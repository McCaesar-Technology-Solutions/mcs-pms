'use client'

import { Bell, ChevronDown, LogOut, Menu, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HeaderSearch } from '@/components/dashboard/header-search'
import { currentUser } from '@/lib/mock-data'
import { signOut } from '@/app/actions/auth'
import type { Profile } from '@/types'

interface TopbarProps {
  onMenuOpen?: () => void
  profile?: Profile | null
}

export default function Topbar({ onMenuOpen, profile }: TopbarProps) {
  const user = profile
    ? { name: profile.name, email: profile.email }
    : { name: currentUser.name, email: currentUser.email }
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!showUserMenu) return

    const onPointerDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showUserMenu])

  return (
    <header className={`main-header glass-header ${scrolled ? 'glass-header--scrolled' : ''}`}>
      <div className="relative flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          className="main-header-icon shrink-0 rounded-xl p-2.5 transition-colors hover:bg-white/50 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="absolute left-1/2 hidden w-full max-w-xl -translate-x-1/2 px-4 md:block">
          <HeaderSearch />
        </div>

        <div className="min-w-0 flex-1 md:hidden">
          <HeaderSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          <button
            type="button"
            className="main-header-icon relative rounded-xl p-2.5 transition-colors hover:bg-white/50"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-destructive" />
          </button>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              className="main-header-user flex items-center gap-2 rounded-xl bg-white/50 px-2 py-1.5 shadow-elevation-1 backdrop-blur-sm transition-all hover:bg-white/70 hover:shadow-elevation-2 sm:px-2.5 md:px-3 md:py-2"
            >
              <div className="gradient-primary flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white">
                {user.name.charAt(0)}
              </div>
              <span className="main-header-user-name hidden text-sm font-medium sm:inline">
                {user.name}
              </span>
              <ChevronDown className="main-header-icon hidden h-4 w-4 sm:block" />
            </button>

            {showUserMenu && (
              <div className="modal-panel surface-card absolute right-0 mt-2 w-52 overflow-hidden bg-white py-1 shadow-elevation-3">
                <div className="surface-card-header px-4 py-3">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="modal-panel-subtle text-xs">{user.email}</p>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-secondary/60"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
