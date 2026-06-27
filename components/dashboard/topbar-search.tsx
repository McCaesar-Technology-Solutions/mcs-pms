'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { getDashboardSearchBase } from '@/lib/dashboard/primary-actions'
import type { Profile } from '@/types'

interface TopbarSearchProps {
  profile?: Profile | null
}

export function TopbarSearch({ profile }: TopbarSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const base = getDashboardSearchBase(profile?.role)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`${base}?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="topbar-search hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
      <Search className="topbar-search__icon h-4 w-4" strokeWidth={2} aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search guests, rooms, reservations…"
        className="topbar-search__input"
        aria-label="Search reservations"
      />
      <kbd className="topbar-search__kbd hidden lg:inline-flex">⌘K</kbd>
    </form>
  )
}
