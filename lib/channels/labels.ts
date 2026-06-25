import type { ChannelProvider } from '@/types'

export const PROVIDER_LABEL: Record<ChannelProvider, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  other: 'Other',
}

export interface ChannelFeedView {
  id: string
  hotelId: string
  roomId: string | null
  name: string
  provider: ChannelProvider
  direction: 'import' | 'export'
  importUrl: string | null
  exportToken: string
  isActive: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'ok' | 'error' | 'pending' | null
  lastSyncMessage: string | null
  eventsSynced: number
  createdAt: string
  roomNumber: string | null
  exportUrl: string | null
}
