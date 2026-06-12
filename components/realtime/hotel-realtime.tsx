'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import {
  RealtimeRefreshProvider,
  useRealtimeRefreshContext,
} from '@/components/realtime/realtime-refresh-context'
import { RealtimeLayoutRefresh } from '@/components/realtime/realtime-layout-refresh'

interface HotelRealtimeProviderProps {
  hotelId: string
  children: ReactNode
}

function hotelFilter(hotelId: string) {
  return `hotel_id=eq.${hotelId}`
}

function HotelRealtimeChannel({ hotelId, children }: HotelRealtimeProviderProps) {
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

    const refreshLayout = () => publish('layout')
    const refreshComplaints = () => publish(['complaints', 'layout'])
    const refreshHousekeeping = () => publish(['housekeeping', 'layout'])

    const channel = supabase.channel(`hotel-live-${hotelId}-${retryKey}`)

    const layoutTables = [
      'reservations',
      'guests',
      'rooms',
      'room_categories',
      'invoices',
      'profiles',
      'staff_invites',
    ] as const

    for (const table of layoutTables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: hotelFilter(hotelId) },
        () => {
          refreshLayout()
        },
      )
    }

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'complaints',
          filter: hotelFilter(hotelId),
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
          filter: hotelFilter(hotelId),
        },
        (payload) => {
          const row = payload.new as { status?: string; approval_stage?: string | null }
          if (row.status === 'pending_approval') {
            import('sonner').then(({ toast }) => {
              const label =
                row.approval_stage === 'estimate'
                  ? 'Technician invoice awaiting approval'
                  : 'Job ready for approval'
              toast.success(label)
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
          filter: hotelFilter(hotelId),
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
          filter: hotelFilter(hotelId),
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
          filter: hotelFilter(hotelId),
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            import('sonner').then(({ toast }) => {
              toast.info('New housekeeping task')
            })
          }
          refreshHousekeeping()
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

export function HotelRealtimeProvider({ hotelId, children }: HotelRealtimeProviderProps) {
  return (
    <RealtimeRefreshProvider>
      <HotelRealtimeChannel hotelId={hotelId}>{children}</HotelRealtimeChannel>
    </RealtimeRefreshProvider>
  )
}

/** @deprecated Use HotelRealtimeProvider */
export const ManagerRealtimeProvider = HotelRealtimeProvider
