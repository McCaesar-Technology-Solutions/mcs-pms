import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { ensureExportFeedsForHotel } from '@/lib/channels/ensure-export-feeds'
import { getAppOrigin } from '@/lib/env'
import type { ChannelFeedView } from '@/lib/channels/labels'
import type { ChannelIcalFeed, ChannelProvider } from '@/types'

export type { ChannelFeedView } from '@/lib/channels/labels'
export { PROVIDER_LABEL } from '@/lib/channels/labels'

export type ChannelFeedRow = ChannelFeedView

export async function getChannelsData(): Promise<{
  importFeeds: ChannelFeedRow[]
  exportFeeds: ChannelFeedRow[]
  rooms: { id: string; number: string }[]
} | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'owner') return null
  if (!(await ownerOwnsHotel(profile.id, profile.hotel_id))) return null

  await ensureExportFeedsForHotel(profile.hotel_id)

  const admin = createAdminClient()
  const origin = getAppOrigin()

  const [{ data: feeds }, { data: rooms }] = await Promise.all([
    admin
      .from('channel_ical_feeds')
      .select('*')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: true }),
    admin.from('rooms').select('id, number').eq('hotel_id', profile.hotel_id).order('number'),
  ])

  const roomMap = new Map((rooms ?? []).map((r) => [r.id, r.number]))
  const mapFeed = (row: NonNullable<typeof feeds>[number]): ChannelFeedRow => ({
    id: row.id,
    hotelId: row.hotel_id,
    roomId: row.room_id,
    name: row.name,
    provider: row.provider as ChannelProvider,
    direction: row.direction as 'import' | 'export',
    importUrl: row.import_url,
    exportToken: row.export_token,
    isActive: row.is_active,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as ChannelIcalFeed['lastSyncStatus'],
    lastSyncMessage: row.last_sync_message,
    eventsSynced: row.events_synced,
    createdAt: row.created_at,
    roomNumber: row.room_id ? (roomMap.get(row.room_id) ?? null) : null,
    exportUrl:
      row.direction === 'export' ? `${origin}/api/ical/${row.export_token}` : null,
  })

  const all = (feeds ?? []).map(mapFeed)
  return {
    importFeeds: all.filter((f) => f.direction === 'import'),
    exportFeeds: all.filter((f) => f.direction === 'export'),
    rooms: (rooms ?? []).map((r) => ({ id: r.id, number: r.number })),
  }
}
