'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import {
  RealtimeRefreshProvider,
  useRealtimeRefreshContext,
} from '@/components/realtime/realtime-refresh-context'

interface TechnicianRealtimeProps {
  userId: string
  children: ReactNode
}

function TechnicianRealtimeChannel({ userId, children }: TechnicianRealtimeProps) {
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

    const refreshComplaints = () => publish('complaints')

    const channel = supabase
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
          const row = payload.new as {
            status?: string
            estimate_approved_at?: string | null
          }
          const prev = payload.old as { status?: string } | undefined
          import('sonner').then(({ toast }) => {
            if (row.status === 'assigned' && row.estimate_approved_at) {
              toast.success('Invoice approved — you can start the job')
            } else if (row.status === 'assigned' && prev?.status !== 'assigned') {
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
        () => {
          refreshComplaints()
        },
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
  }, [userId, retryKey, publish])

  return (
    <>
      {disconnected && <RealtimeReconnectBanner onReconnect={reconnect} />}
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
