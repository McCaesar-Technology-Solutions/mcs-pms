'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'

interface ManagerRealtimeProviderProps {
  hotelId: string
  children: ReactNode
}

export function ManagerRealtimeProvider({ hotelId, children }: ManagerRealtimeProviderProps) {
  const [disconnected, setDisconnected] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const reconnect = useCallback(() => {
    setRetryKey((k) => k + 1)
    setDisconnected(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let backoff = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let channel = supabase
      .channel(`manager-complaints-${hotelId}-${retryKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints', filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const row = payload.new as { room_id?: string; category?: string }
          import('sonner').then(({ toast }) => {
            toast.info(`New complaint — ${row.category ?? 'issue'} reported`)
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'complaints', filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const row = payload.new as { status?: string; room_id?: string }
          if (row.status === 'pending_approval') {
            import('sonner').then(({ toast }) => {
              toast.success('Job ready for approval')
            })
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          backoff = 1000
          setDisconnected(false)
        }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setDisconnected(true)
          retryTimer = setTimeout(() => {
            setRetryKey((k) => k + 1)
          }, backoff)
          backoff = Math.min(backoff * 2, 8000)
        }
      })

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      supabase.removeChannel(channel)
    }
  }, [hotelId, retryKey])

  return (
    <>
      {disconnected && <RealtimeReconnectBanner onReconnect={reconnect} />}
      {children}
    </>
  )
}
