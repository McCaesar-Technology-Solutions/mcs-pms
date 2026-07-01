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
    setNavItems((prev) => {
      const base = prev.length > 0 ? prev : (initialNavigation ?? [])
      return applyBadgeMap(base, badges)
    })
    setNavGroups((prev) => {
      const base = prev ?? initialNavGroups
      if (!base) return prev
      return base.map((group) => ({
        ...group,
        items: applyBadgeMap(group.items, badges),
      }))
    })
  }, [initialNavigation, initialNavGroups])

  useRealtimeRefresh('layout', refreshBadges)
  useRealtimeRefresh('complaints', refreshBadges)
  useRealtimeRefresh('housekeeping', refreshBadges)
  useRealtimeRefresh('messages', refreshBadges)
  useRealtimeRefresh('guest_portal', refreshBadges)

  useEffect(() => {
    void refreshBadges()
  }, [refreshBadges])

  return { navItems, navGroups, refreshBadges }
}
