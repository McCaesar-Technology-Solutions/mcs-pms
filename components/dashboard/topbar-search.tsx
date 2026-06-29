'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useCommandPaletteOptional } from '@/components/dashboard/command-palette'
import { getDashboardSearchBase } from '@/lib/dashboard/primary-actions'
import type { Profile } from '@/types'

interface TopbarSearchProps {
  profile?: Profile | null
}

export function TopbarSearch({ profile }: TopbarSearchProps) {
  const router = useRouter()
  const palette = useCommandPaletteOptional()
  const [query, setQuery] = useState('')
  const base = getDashboardSearchBase(profile?.role)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (palette) {
      palette.setOpen(true)
      return
    }
    if (!trimmed) return
    router.push(`${base}?q=${encodeURIComponent(trimmed)}`)
  }

  function openPalette() {
    palette?.setOpen(true)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="topbar-search min-w-0 flex-1 md:max-w-md lg:max-w-lg"
    >
      <Search className="topbar-search__icon h-4 w-4" strokeWidth={2} aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={openPalette}
        onClick={openPalette}
        readOnly={Boolean(palette)}
          placeholder="Search guests, rooms, bookings, invoices…"
        className="topbar-search__input"
        aria-label="Open command palette"
      />
      <button
        type="button"
        onClick={openPalette}
        className="topbar-search__kbd hidden lg:inline-flex"
        aria-label="Open command palette"
      >
        ⌘K
      </button>
    </form>
  )
}
