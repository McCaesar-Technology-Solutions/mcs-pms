'use client'

import { useEffect, useId, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { searchGuests } from '@/app/actions/stays'

export interface GuestSearchMatch {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface GuestSearchFieldProps {
  label: string
  placeholder?: string
  fieldClass: string
  selectedGuestId: string | null
  onSelectGuest: (guest: GuestSearchMatch | null) => void
  onGuestNameChange?: (name: string) => void
}

export function GuestSearchField({
  label,
  placeholder = 'Search name or phone…',
  fieldClass,
  selectedGuestId,
  onSelectGuest,
  onGuestNameChange,
}: GuestSearchFieldProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<GuestSearchMatch[]>([])
  const [picked, setPicked] = useState<GuestSearchMatch | null>(null)
  const [open, setOpen] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (picked) return
    const q = query.trim()
    if (q.length < 2) {
      setMatches([])
      setSearchError(null)
      return
    }
    const t = setTimeout(async () => {
      const result = await searchGuests(q)
      if (!result.success) {
        setMatches([])
        setSearchError(result.error ?? 'Search failed.')
        return
      }
      setSearchError(null)
      setMatches(result.data ?? [])
      setOpen(true)
    }, 300)
    return () => clearTimeout(t)
  }, [query, picked])

  function selectGuest(g: GuestSearchMatch) {
    setPicked(g)
    setQuery('')
    setMatches([])
    setOpen(false)
    setSearchError(null)
    onSelectGuest(g)
    onGuestNameChange?.(g.name)
  }

  function clearPick() {
    setPicked(null)
    setQuery('')
    setMatches([])
    setOpen(false)
    onSelectGuest(null)
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>

      {picked ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{picked.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[picked.phone, picked.email].filter(Boolean).join(' · ') || 'Returning guest'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearPick}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white hover:text-foreground"
            aria-label="Clear selected guest"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              if (matches.length > 0) setOpen(true)
            }}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150)
            }}
            placeholder={placeholder}
            className={`${fieldClass} pl-9`}
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
          />
          {open && matches.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-elevation-2"
            >
              {matches.map((g) => (
                <li key={g.id} role="option" aria-selected={selectedGuestId === g.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectGuest(g)}
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-secondary"
                  >
                    <span className="font-medium text-foreground">{g.name}</span>
                    {g.phone && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{g.phone}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {searchError && !picked && (
        <p className="mt-1.5 text-xs text-destructive">{searchError}</p>
      )}
    </div>
  )
}
