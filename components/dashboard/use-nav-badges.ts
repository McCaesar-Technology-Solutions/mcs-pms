'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadNavBadgeMap } from '@/app/actions/alert-counts'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import type { NavGroup, NavItem } from '@/lib/navigation'

function applyBadgeMap(items: NavItem[], badges: Record<string, number>): NavItem[] {
  return items.map((item) => {
    const count = badges[item.href]
    return {
      ...item,
      badge: count != null && count > 0 ? count : undefined,
    }
  })
}

export function useNavBadges(
  initialNavigation?: NavItem[],
  initialNavGroups?: NavGroup[],
) {
  const [navItems, setNavItems] = useState(initialNavigation ?? [])
  const [navGroups, setNavGroups] = useState(initialNavGroups)

  useEffect(() => {
    setNavItems(initialNavigation ?? [])
  }, [initialNavigation])

  useEffect(() => {
    setNavGroups(initialNavGroups)
  }, [initialNavGroups])

  const refreshBadges = useCallback(async () => {
    const badges = await loadNavBadgeMap()
    setNavItems((prev) => applyBadgeMap(prev, badges))
    setNavGroups((prev) =>
      prev?.map((group) => ({
        ...group,
        items: applyBadgeMap(group.items, badges),
      })),
    )
  }, [])

  useEffect(() => {
    void refreshBadges()
  }, [refreshBadges])

  useRealtimeRefresh('layout', refreshBadges)
  useRealtimeRefresh('complaints', refreshBadges)
  useRealtimeRefresh('housekeeping', refreshBadges)
  useRealtimeRefresh('messages', refreshBadges)
  useRealtimeRefresh('guest_portal', refreshBadges)

  return { navItems, navGroups, refreshBadges }
}
