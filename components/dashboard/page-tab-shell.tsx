'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

export interface PageTab {
  id: string
  label: string
  badge?: number
}

interface PageTabShellProps {
  tabs: PageTab[]
  defaultTab?: string
  /** Map hash fragment (without #) to tab id — for deep links like #guest-feedback */
  hashToTab?: Record<string, string>
  panels: Record<string, ReactNode>
  scrollable?: boolean
  className?: string
}

export function PageTabShell({
  tabs,
  defaultTab,
  hashToTab = {},
  panels,
  scrollable = true,
  className,
}: PageTabShellProps) {
  const fallback = defaultTab ?? tabs[0]?.id ?? 'overview'

  const resolveTab = useCallback(
    (hash: string) => {
      const key = hash.replace(/^#/, '').split('?')[0]
      if (!key) return fallback
      if (tabs.some((t) => t.id === key)) return key
      return hashToTab[key] ?? fallback
    },
    [fallback, hashToTab, tabs],
  )

  const [active, setActive] = useState(fallback)

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash
      const tab = resolveTab(hash)
      setActive(tab)

      const anchor = hash.replace(/^#/, '').split('?')[0]
      if (anchor && anchor !== tab && document.getElementById(anchor)) {
        requestAnimationFrame(() => {
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }

    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [resolveTab])

  function selectTab(id: string) {
    setActive(id)
    window.history.replaceState(null, '', `#${id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={className}>
      <nav
        className={`page-tab-nav ${scrollable ? 'page-tab-nav--scroll' : ''}`}
        role="tablist"
        aria-label="Page sections"
      >
        {tabs.map((tab) => {
          const selected = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              className={`page-tab-nav__item ${selected ? 'page-tab-nav__item--active' : ''}`}
            >
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="page-tab-nav__badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="mt-4 space-y-4 sm:mt-6 sm:space-y-6 dashboard-tab-panel"
      >
        {panels[active]}
      </div>
    </div>
  )
}
