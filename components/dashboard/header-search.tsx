'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BedDouble, CalendarDays, FileText, Loader2, Search, User } from 'lucide-react'
import { globalSearch, type GlobalSearchResult, type SearchResultKind } from '@/app/actions/search'
import type { UserRole } from '@/types'

interface HeaderSearchProps {
  className?: string
  role?: UserRole
}

const KIND_ICONS: Record<SearchResultKind, typeof User> = {
  guest: User,
  reservation: CalendarDays,
  room: BedDouble,
  invoice: FileText,
}

export function HeaderSearch({ className = '', role = 'manager' }: HeaderSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(
    (value: string) => {
      if (value.trim().length < 2) {
        setResults([])
        setOpen(false)
        return
      }

      startTransition(async () => {
        const result = await globalSearch(value)
        if (result.success) {
          setResults(result.data)
          setOpen(result.data.length > 0)
        }
      })
    },
    [],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 280)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const onSelect = (item: GlobalSearchResult) => {
    setOpen(false)
    setQuery('')
    router.push(item.href)
  }

  const showDropdown = open && (results.length > 0 || pending)

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <div className="header-search-glass relative h-10 w-full rounded-xl">
        <Search className="header-search-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        {pending && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <input
          type="search"
          placeholder="Search guests, bookings, rooms..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          className="header-search-glass__input h-full w-full rounded-xl pl-10 pr-4 text-sm outline-none focus:outline-none focus:ring-0"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          role="combobox"
        />
      </div>

      {showDropdown && (
        <div className="modal-panel surface-card absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto py-1 shadow-elevation-3">
          {pending && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : (
            results.map((item) => {
              const Icon = KIND_ICONS[item.kind]
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
