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
import { Search } from 'lucide-react'
import { CenteredModal } from '@/components/ui/centered-modal'
import {
  buildCommandItems,
  commandSearchHref,
  filterCommandItems,
  type CommandItem,
} from '@/lib/dashboard/command-items'
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

  const allItems = useMemo(() => buildCommandItems(profile?.role), [profile?.role])
  const items = useMemo(() => {
    const base = filterCommandItems(allItems, query)
    const trimmed = query.trim()
    if (!trimmed) return base

    const searchJump: CommandItem = {
      id: 'dynamic-search',
      label: `Search reservations for “${trimmed}”`,
      description: 'Open reservations with this query',
      href: commandSearchHref(profile?.role, trimmed),
      kind: 'search',
      icon: Search,
    }

    return [searchJump, ...base.filter((item) => item.id !== 'action-search-reservations')]
  }, [allItems, query, profile?.role])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      return
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

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

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      className="max-w-xl"
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
          placeholder="Search pages, actions, or reservations…"
          className="command-palette__input"
          aria-label="Command palette search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <kbd className="command-palette__kbd">esc</kbd>
      </div>

      <div className="command-palette__results" role="listbox" aria-label="Commands">
        {items.length === 0 ? (
          <p className="command-palette__empty">No matching commands.</p>
        ) : (
          items.map((item, index) => {
            const Icon = item.icon
            const active = index === activeIndex
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
                  {item.kind}
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
