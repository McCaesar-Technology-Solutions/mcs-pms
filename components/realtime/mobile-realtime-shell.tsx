'use client'

import type { ReactNode } from 'react'
import { HotelRealtimeProvider } from '@/components/realtime/hotel-realtime'

interface MobileRealtimeShellProps {
  hotelId: string
  children: ReactNode
}

/** Wraps standalone mobile pages with the same hotel realtime channel as AppShell. */
export function MobileRealtimeShell({ hotelId, children }: MobileRealtimeShellProps) {
  return <HotelRealtimeProvider hotelId={hotelId}>{children}</HotelRealtimeProvider>
}
