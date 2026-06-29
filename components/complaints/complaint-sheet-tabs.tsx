'use client'

import { useEffect, useState, type ReactNode } from 'react'

export interface ComplaintSheetTab {
  id: string
  label: string
  badge?: number
}

interface ComplaintSheetTabsProps {
  tabs: ComplaintSheetTab[]
  panels: Record<string, ReactNode>
  defaultTab?: string
  /** Resets active tab when the open complaint changes */
  complaintId: string
}

export function ComplaintSheetTabs({
  tabs,
  panels,
  defaultTab,
  complaintId,
}: ComplaintSheetTabsProps) {
  const fallback = defaultTab && tabs.some((t) => t.id === defaultTab)
    ? defaultTab
    : (tabs[0]?.id ?? 'details')

  const [active, setActive] = useState(fallback)

  useEffect(() => {
    setActive(fallback)
  }, [complaintId, fallback])

  if (tabs.length === 0) return null

  const safeActive = tabs.some((t) => t.id === active) ? active : tabs[0]!.id

  return (
    <div className="complaint-sheet-tabs">
      <nav
        className="complaint-sheet-tabs__nav page-tab-nav page-tab-nav--scroll"
        role="tablist"
        aria-label="Complaint sections"
      >
        {tabs.map((tab) => {
          const selected = safeActive === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`complaint-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`complaint-tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
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
        id={`complaint-tabpanel-${safeActive}`}
        aria-labelledby={`complaint-tab-${safeActive}`}
        className="complaint-sheet-tabs__panel"
      >
        {panels[safeActive]}
      </div>
    </div>
  )
}
