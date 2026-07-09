'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'

const LAYOUT_REFRESH_MS = 5000

/** Re-runs server layouts (nav badges, occupancy, etc.) when realtime events fire. */
export function RealtimeLayoutRefresh() {
  const router = useRouter()
  const lastRefreshRef = useRef(0)

  const refresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current < LAYOUT_REFRESH_MS) return
    lastRefreshRef.current = now
    router.refresh()
  }, [router])

  useRealtimeRefresh('layout', refresh)
  return null
}
