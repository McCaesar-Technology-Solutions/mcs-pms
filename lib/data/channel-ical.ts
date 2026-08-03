import { createAdminClient } from '@/lib/supabase/admin'
import type { ChannelIcalFeedRow } from '@/lib/ical/sync-import'

function publicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export interface ChannelIcalFeedView {
  id: string
  hotelId: string
  roomId: string
  roomNumber: string
  name: string
  provider: 'airbnb' | 'booking_com' | 'other'
  direction: 'import' | 'export'
  importUrl: string | null
  exportUrl: string
  isActive: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'ok' | 'error' | 'pending' | null
  lastSyncMessage: string | null
  eventsSynced: number
}

function toView(row: ChannelIcalFeedRow, roomNumber: string): ChannelIcalFeedView | null {
  if (!row.room_id) return null
  return {
    id: row.id,
    hotelId: row.hotel_id,
    roomId: row.room_id,
    roomNumber,
    name: row.name,
    provider: row.provider,
    direction: row.direction,
    importUrl: row.import_url,
    exportUrl: `${publicAppOrigin()}/api/ical/${row.export_token}.ics`,
    isActive: row.is_active,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncMessage: row.last_sync_message,
    eventsSynced: row.events_synced,
  }
}

export async function getChannelIcalFeeds(hotelId: string): Promise<ChannelIcalFeedView[]> {
  const admin = createAdminClient()
  const [{ data: feeds, error }, { data: rooms }] = await Promise.all([
    admin
      .from('channel_ical_feeds')
      .select(
        'id, hotel_id, room_id, name, provider, direction, import_url, export_token, is_active, last_sync_at, last_sync_status, last_sync_message, events_synced, last_http_etag, last_content_hash, sync_lock_until',
      )
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: true }),
    admin.from('rooms').select('id, number').eq('hotel_id', hotelId),
  ])

  if (error) throw error

  const roomNumbers = new Map((rooms ?? []).map((r) => [r.id, r.number]))

  return ((feeds ?? []) as ChannelIcalFeedRow[])
    .map((row) => toView(row, roomNumbers.get(row.room_id ?? '') ?? '—'))
    .filter((v): v is ChannelIcalFeedView => v != null)
}

export async function getImportFeedsForHotel(hotelId: string): Promise<ChannelIcalFeedView[]> {
  const feeds = await getChannelIcalFeeds(hotelId)
  return feeds.filter((f) => f.direction === 'import')
}
