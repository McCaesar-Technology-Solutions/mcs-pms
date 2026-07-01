'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadNavBadgeMap } from '@/app/actions/alert-counts'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'

export function useMessagesNavBadge(messagesHref: string) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const badges = await loadNavBadgeMap()
    setCount(badges[messagesHref] ?? 0)
  }, [messagesHref])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRealtimeRefresh('messages', refresh)
  useRealtimeRefresh('layout', refresh)

  return count
}
