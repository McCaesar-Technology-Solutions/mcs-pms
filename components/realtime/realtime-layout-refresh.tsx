'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'

/** Re-runs server layouts (nav badges, occupancy, etc.) when realtime events fire. */
export function RealtimeLayoutRefresh() {
  const router = useRouter()
  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useRealtimeRefresh('layout', refresh)
  return null
}
