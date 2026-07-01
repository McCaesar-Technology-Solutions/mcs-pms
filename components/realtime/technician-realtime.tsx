'use client'

import { useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import {
  RealtimeRefreshProvider,
  useRealtimeRefreshContext,
} from '@/components/realtime/realtime-refresh-context'
import { useRealtimeSubscription } from '@/components/realtime/use-realtime-subscription'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface TechnicianRealtimeProps {
  userId: string
  children: ReactNode
}

function TechnicianRealtimeChannel({ userId, children }: TechnicianRealtimeProps) {
  const { publish } = useRealtimeRefreshContext()

  const subscribe = useCallback(
    (supabase: ReturnType<typeof createClient>, retryKey: number): RealtimeChannel => {
      const refreshComplaints = () => publish('complaints')
      const refreshMessages = () => publish(['messages', 'layout'])

      return supabase
        .channel(`technician-live-${userId}-${retryKey}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'complaints',
            filter: `assigned_to=eq.${userId}`,
          },
          () => {
            import('sonner').then(({ toast }) => {
              toast.info('New task assigned')
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
            filter: `assigned_to=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as { status?: string }
            const prev = payload.old as { status?: string } | undefined
            import('sonner').then(({ toast }) => {
              if (row.status === 'assigned' && prev?.status !== 'assigned') {
                toast.info('New task assigned')
              } else if (row.status === 'rejected') {
                toast.warning('Job sent back — check manager notes')
              } else if (row.status === 'resolved') {
                toast.success('Job approved and closed')
              }
            })
            refreshComplaints()
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'complaints',
            filter: `assigned_to=eq.${userId}`,
          },
          refreshComplaints,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'housekeeping_tasks',
            filter: `assigned_to=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              import('sonner').then(({ toast }) => {
                toast.info('New housekeeping task assigned')
              })
            }
            publish('housekeeping')
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'staff_conversation_messages',
          },
          (payload) => {
            const row = payload.new as { author_id?: string }
            if (row.author_id !== userId) {
              import('sonner').then(({ toast }) => {
                toast.info('New team message')
              })
            }
            refreshMessages()
          },
        )
    },
    [userId, publish],
  )

  const { showReconnectBanner, reconnect } = useRealtimeSubscription(subscribe, [userId])

  return (
    <>
      {showReconnectBanner && <RealtimeReconnectBanner onReconnect={reconnect} />}
      {children}
    </>
  )
}

export function TechnicianRealtime({ userId, children }: TechnicianRealtimeProps) {
  return (
    <RealtimeRefreshProvider>
      <TechnicianRealtimeChannel userId={userId}>{children}</TechnicianRealtimeChannel>
    </RealtimeRefreshProvider>
  )
}
