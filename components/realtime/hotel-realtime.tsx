'use client'

import { useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import {
  RealtimeRefreshProvider,
  useRealtimeRefreshContext,
} from '@/components/realtime/realtime-refresh-context'
import { RealtimeLayoutRefresh } from '@/components/realtime/realtime-layout-refresh'
import { useRealtimeSubscription } from '@/components/realtime/use-realtime-subscription'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface HotelRealtimeProviderProps {
  hotelId: string
  currentUserId?: string
  children: ReactNode
}

function hotelFilter(hotelId: string) {
  return `hotel_id=eq.${hotelId}`
}

function HotelRealtimeChannel({ hotelId, currentUserId, children }: HotelRealtimeProviderProps) {
  const { publish } = useRealtimeRefreshContext()

  const subscribe = useCallback(
    (supabase: ReturnType<typeof createClient>, retryKey: number): RealtimeChannel[] => {
      const refreshLayout = () => publish('layout')
      const refreshComplaints = () => publish(['complaints', 'layout'])
      const refreshHousekeeping = () => publish(['housekeeping', 'layout'])
      const refreshMessages = () => publish(['messages', 'layout'])
      const refreshGuestPortal = () => publish(['guest_portal', 'layout'])

      const layoutTables = [
        'reservations',
        'guests',
        'rooms',
        'room_categories',
        'invoices',
        'profiles',
        'staff_invites',
      ] as const

      const opsChannel = supabase.channel(`hotel-live-ops-${hotelId}-${retryKey}`)
      for (const table of layoutTables) {
        opsChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: hotelFilter(hotelId) },
          refreshLayout,
        )
      }

      opsChannel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'complaints', filter: hotelFilter(hotelId) },
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
          { event: 'UPDATE', schema: 'public', table: 'complaints', filter: hotelFilter(hotelId) },
          (payload) => {
            const row = payload.new as { status?: string; approval_stage?: string | null }
            if (row.status === 'pending_approval') {
              import('sonner').then(({ toast }) => {
                if (row.approval_stage !== 'estimate') {
                  toast.success('Job ready for approval')
                }
              })
            }
            refreshComplaints()
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'complaints', filter: hotelFilter(hotelId) },
          refreshComplaints,
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
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'guest_requests',
            filter: hotelFilter(hotelId),
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              import('sonner').then(({ toast }) => {
                toast.info('New guest request')
              })
            }
            refreshGuestPortal()
          },
        )

      const messagesChannel = supabase.channel(`hotel-live-messages-${hotelId}-${retryKey}`)
      messagesChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint_messages' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as { author_role?: string }
            if (row.author_role === 'guest') {
              import('sonner').then(({ toast }) => {
                toast.info('New guest message on a complaint')
              })
            }
          }
          refreshMessages()
          refreshComplaints()
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'guest_conversation_messages' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as { author_role?: string }
              if (row.author_role === 'guest') {
                import('sonner').then(({ toast }) => {
                  toast.info('New guest message')
                })
              }
            }
            refreshMessages()
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'staff_conversation_messages' },
          (payload) => {
            const row = payload.new as { author_id?: string }
            if (!currentUserId || row.author_id !== currentUserId) {
              import('sonner').then(({ toast }) => {
                toast.info('New team message')
              })
            }
            refreshMessages()
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'guest_conversations',
            filter: hotelFilter(hotelId),
          },
          refreshMessages,
        )

      return [opsChannel, messagesChannel]
    },
    [hotelId, currentUserId, publish],
  )

  const { showReconnectBanner, reconnect } = useRealtimeSubscription(subscribe, [hotelId, currentUserId])

  return (
    <>
      <RealtimeLayoutRefresh />
      {showReconnectBanner && <RealtimeReconnectBanner onReconnect={reconnect} />}
      {children}
    </>
  )
}

export function HotelRealtimeProvider({ hotelId, currentUserId, children }: HotelRealtimeProviderProps) {
  return (
    <RealtimeRefreshProvider>
      <HotelRealtimeChannel hotelId={hotelId} currentUserId={currentUserId}>
        {children}
      </HotelRealtimeChannel>
    </RealtimeRefreshProvider>
  )
}

/** @deprecated Use HotelRealtimeProvider */
export const ManagerRealtimeProvider = HotelRealtimeProvider
