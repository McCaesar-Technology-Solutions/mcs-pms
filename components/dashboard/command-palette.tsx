'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { searchGlobalAction } from '@/app/actions/global-search'
import { CenteredModal } from '@/components/ui/centered-modal'
import {
  buildCommandItems,
  buildDynamicSearchItems,
  filterCommandItems,
  type CommandItem,
} from '@/lib/dashboard/command-items'
import { globalResultsToCommandItems } from '@/lib/dashboard/global-search-items'
import type { Profile } from '@/types'

interface CommandPaletteContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPaletteOptional() {
  return useContext(CommandPaletteContext)
}

export function useCommandPalette() {
  const ctx = useCommandPaletteOptional()
  if (!ctx) {
    throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  }
  return ctx
}

export function CommandPaletteProvider({
  profile,
  children,
}: {
  profile?: Profile | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandPaletteDialog open={open} onClose={() => setOpen(false)} profile={profile} />
    </CommandPaletteContext.Provider>
  )
}

function CommandPaletteDialog({
  open,
  onClose,
  profile,
}: {
  open: boolean
  onClose: () => void
  profile?: Profile | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recordItems, setRecordItems] = useState<CommandItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchGen = useRef(0)

  const allItems = useMemo(() => buildCommandItems(profile?.role), [profile?.role])

  useEffect(() => {
    const trimmed = query.trim()
    if (!open || trimmed.length < 2) {
      setRecordItems([])
      setSearching(false)
      return
    }

    const gen = ++searchGen.current
    setSearching(true)
    const timer = window.setTimeout(() => {
      void searchGlobalAction(trimmed).then((results) => {
        if (gen !== searchGen.current) return
        setRecordItems(globalResultsToCommandItems(results))
        setSearching(false)
      })
    }, 220)

    return () => window.clearTimeout(timer)
  }, [open, query])

  const items = useMemo(() => {
    const trimmed = query.trim()
    const fallback = buildDynamicSearchItems(profile?.role, query)
    const base = filterCommandItems(allItems, query)

    if (!trimmed) return base

    const staticSearchIds = new Set([
      'action-search-reservations',
      'action-search-guests',
      'action-search-rooms',
      'action-search-complaints',
    ])

    const pages = base.filter((item) => !staticSearchIds.has(item.id))

    if (recordItems.length > 0) {
      return [...recordItems, ...fallback.slice(0, 2), ...pages.slice(0, 6)]
    }

    return [...fallback, ...pages]
  }, [allItems, query, profile?.role, recordItems])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      setRecordItems([])
      setSearching(false)
      return
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, recordItems.length])

  const runItem = useCallback(
    (item: CommandItem) => {
      onClose()
      router.push(item.href)
    },
    [onClose, router],
  )

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault()
      runItem(items[activeIndex])
    }
  }

  const trimmed = query.trim()

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      className="command-palette-modal max-w-xl"
      panelClassName="command-palette"
      aria-label="Command palette"
    >
      <div className="command-palette__search">
        <Search className="command-palette__search-icon h-4 w-4" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Search guests, rooms, bookings, invoices…"
          className="command-palette__input"
          aria-label="Command palette search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {searching ? (
          <Loader2 className="command-palette__spinner h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <kbd className="command-palette__kbd">esc</kbd>
        )}
      </div>

      <div className="command-palette__results" role="listbox" aria-label="Commands">
        {items.length === 0 ? (
          <p className="command-palette__empty">
            {trimmed.length >= 2 && searching
              ? 'Searching…'
              : trimmed.length >= 2
                ? 'No matches — try a guest name, room number, or booking ref.'
                : 'Type to search your property data, or pick a page below.'}
          </p>
        ) : (
          items.map((item, index) => {
            const Icon = item.icon
            const active = index === activeIndex
            const kindLabel = item.meta ?? item.kind
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`command-palette__item ${active ? 'command-palette__item--active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runItem(item)}
              >
                <span className="command-palette__item-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
                <span className={`command-palette__item-kind command-palette__item-kind--${item.kind}`}>
                  {kindLabel}
                </span>
              </button>
            )
          })
        )}
      </div>

      <div className="command-palette__footer">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> open
        </span>
      </div>
    </CenteredModal>
  )
}
