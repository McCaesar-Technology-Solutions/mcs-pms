'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import {
  RealtimeRefreshProvider,
  useRealtimeRefreshContext,
} from '@/components/realtime/realtime-refresh-context'
import { RealtimeLayoutRefresh } from '@/components/realtime/realtime-layout-refresh'

interface ManagerRealtimeProviderProps {
  hotelId: string
  children: ReactNode
}

function ManagerRealtimeChannel({ hotelId, children }: ManagerRealtimeProviderProps) {
  const { publish } = useRealtimeRefreshContext()
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

    const refreshComplaints = () => publish(['complaints', 'layout'])

    const channel = supabase
      .channel(`manager-live-${hotelId}-${retryKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'complaints',
          filter: `hotel_id=eq.${hotelId}`,
        },
        (payload) => {
          const row = payload.new as { category?: string }
          import('sonner').then(({ toast }) => {
            toast.info(`New complaint — ${row.category ?? 'issue'} reported`)
          })
          refreshComplaints()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'complaints',
          filter: `hotel_id=eq.${hotelId}`,
        },
        (payload) => {
          const row = payload.new as { status?: string }
          if (row.status === 'pending_approval') {
            import('sonner').then(({ toast }) => {
              toast.success('Job ready for approval')
            })
          }
          refreshComplaints()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'complaints',
          filter: `hotel_id=eq.${hotelId}`,
        },
        () => {
          refreshComplaints()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaint_estimates',
          filter: `hotel_id=eq.${hotelId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            import('sonner').then(({ toast }) => {
              toast.info('Technician cost estimate received')
            })
          }
          refreshComplaints()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'housekeeping_tasks',
          filter: `hotel_id=eq.${hotelId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            import('sonner').then(({ toast }) => {
              toast.info('New housekeeping task')
            })
          }
          publish(['housekeeping', 'layout'])
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          backoff = 1000
          setDisconnected(false)
        }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setDisconnected(true)
          retryTimer = setTimeout(() => setRetryKey((k) => k + 1), backoff)
          backoff = Math.min(backoff * 2, 8000)
        }
      })

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      supabase.removeChannel(channel)
    }
  }, [hotelId, retryKey, publish])

  return (
    <>
      <RealtimeLayoutRefresh />
      {disconnected && <RealtimeReconnectBanner onReconnect={reconnect} />}
      {children}
    </>
  )
}

export function ManagerRealtimeProvider({ hotelId, children }: ManagerRealtimeProviderProps) {
  return (
    <RealtimeRefreshProvider>
      <ManagerRealtimeChannel hotelId={hotelId}>{children}</ManagerRealtimeChannel>
    </RealtimeRefreshProvider>
  )
}
