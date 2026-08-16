'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadManagerTabBadges } from '@/app/actions/alert-counts'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import { PageTabShell, type PageTab } from '@/components/dashboard/page-tab-shell'
import type { ReactNode } from 'react'

interface LivePageTabShellProps {
  tabs: PageTab[]
  defaultTab?: string
  hashToTab?: Record<string, string>
  panels: Record<string, ReactNode>
  className?: string
}

export function LivePageTabShell({
  tabs: initialTabs,
  ...rest
}: LivePageTabShellProps) {
  const [tabs, setTabs] = useState(initialTabs)

  useEffect(() => {
    setTabs(initialTabs)
  }, [initialTabs])

  const refreshBadges = useCallback(async () => {
    let counts: Awaited<ReturnType<typeof loadManagerTabBadges>>
    try {
      counts = await loadManagerTabBadges()
    } catch (err) {
      console.error('[live-tabs] badge refresh failed:', err)
      return
    }
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === 'overview') {
          return { ...tab, badge: counts.overview > 0 ? counts.overview : undefined }
        }
        if (tab.id === 'requests') {
          return { ...tab, badge: counts.requests > 0 ? counts.requests : undefined }
        }
        if (tab.id === 'guest-portal') {
          return { ...tab, badge: counts.guestPortal > 0 ? counts.guestPortal : undefined }
        }
        return tab
      }),
    )
  }, [])

  useRealtimeRefresh('layout', refreshBadges)
  useRealtimeRefresh('complaints', refreshBadges)
  useRealtimeRefresh('housekeeping', refreshBadges)
  useRealtimeRefresh('messages', refreshBadges)
  useRealtimeRefresh('guest_portal', refreshBadges)

  return <PageTabShell tabs={tabs} {...rest} />
}
