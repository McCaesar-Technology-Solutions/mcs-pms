'use client'

import { Bell, ChevronDown, LogOut, Search, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { currentUser } from '@/lib/mock-data'

export default function Topbar() {
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
    <header className={`main-header glass-header h-16 ${scrolled ? 'glass-header--scrolled' : ''}`}>
      <div className="relative flex h-16 items-center px-4 md:px-6">
        <div className="absolute left-1/2 hidden w-full max-w-xl -translate-x-1/2 px-4 md:block">
          <div className="relative">
            <Search className="main-header-icon absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search guests, bookings, rooms..."
              className="search-soft main-header-input h-10 w-full rounded-xl pl-10 pr-4 text-sm outline-none transition-all"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
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
              className="main-header-user flex items-center gap-2 rounded-xl bg-white/50 px-2.5 py-1.5 shadow-elevation-1 backdrop-blur-sm transition-all hover:bg-white/70 hover:shadow-elevation-2 md:px-3 md:py-2"
            >
              <div className="gradient-primary flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white">
                {currentUser.name.charAt(0)}
              </div>
              <span className="main-header-user-name hidden text-sm font-medium sm:inline">
                {currentUser.name}
              </span>
              <ChevronDown className="main-header-icon h-4 w-4" />
            </button>

            {showUserMenu && (
              <div className="modal-panel surface-card absolute right-0 mt-2 w-52 overflow-hidden py-1 shadow-elevation-3">
                <div className="surface-card-header px-4 py-3">
                  <p className="text-sm font-semibold">{currentUser.name}</p>
                  <p className="modal-panel-subtle text-xs">{currentUser.email}</p>
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
