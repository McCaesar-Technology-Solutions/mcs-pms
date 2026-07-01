'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type SetupChannels = (
  supabase: ReturnType<typeof createClient>,
  retryKey: number,
) => RealtimeChannel | RealtimeChannel[]

const BANNER_DELAY_MS = 2500
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 8000

/**
 * Manages Supabase Realtime channel lifecycle with silent auto-reconnect.
 * Only surfaces the reconnect banner after a sustained failure (not on normal teardown).
 */
export function useRealtimeSubscription(setup: SetupChannels, deps: readonly unknown[]) {
  const [showReconnectBanner, setShowReconnectBanner] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const cancelledRef = useRef(false)
  const setupRef = useRef(setup)
  setupRef.current = setup

  const reconnect = useCallback(() => {
    setShowReconnectBanner(false)
    setRetryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    const supabase = createClient()
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let bannerTimer: ReturnType<typeof setTimeout> | null = null
    let backoff = INITIAL_BACKOFF_MS

    const channels = (() => {
      const result = setupRef.current(supabase, retryKey)
      return Array.isArray(result) ? result : [result]
    })()

    let subscribedCount = 0
    let failed = false

    const clearTimers = () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (bannerTimer) clearTimeout(bannerTimer)
      retryTimer = null
      bannerTimer = null
    }

    const markHealthy = () => {
      subscribedCount += 1
      if (!failed && subscribedCount >= channels.length) {
        backoff = INITIAL_BACKOFF_MS
        clearTimers()
        setShowReconnectBanner(false)
      }
    }

    const scheduleRecovery = () => {
      if (cancelledRef.current) return
      failed = true

      if (!bannerTimer) {
        bannerTimer = setTimeout(() => {
          if (!cancelledRef.current) setShowReconnectBanner(true)
        }, BANNER_DELAY_MS)
      }

      if (!retryTimer) {
        retryTimer = setTimeout(() => {
          if (!cancelledRef.current) setRetryKey((k) => k + 1)
        }, backoff)
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
      }
    }

    for (const channel of channels) {
      channel.subscribe((status) => {
        if (cancelledRef.current) return

        if (status === 'SUBSCRIBED') {
          markHealthy()
          return
        }

        // CLOSED is normal when React tears the channel down — ignore it.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          scheduleRecovery()
        }
      })
    }

    return () => {
      cancelledRef.current = true
      clearTimers()
      for (const channel of channels) {
        void supabase.removeChannel(channel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retryKey is intentional; deps are caller-provided externals
  }, [retryKey, ...deps])

  return { showReconnectBanner, reconnect }
}
