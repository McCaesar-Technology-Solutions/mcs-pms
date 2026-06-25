import { createAdminClient } from '@/lib/supabase/admin'

/** Ensure each room has an active export feed for OTA subscription. */
export async function ensureExportFeedsForHotel(hotelId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: rooms } = await admin
    .from('rooms')
    .select('id, number')
    .eq('hotel_id', hotelId)
    .order('number')

  if (!rooms?.length) return

  const { data: existing } = await admin
    .from('channel_ical_feeds')
    .select('room_id')
    .eq('hotel_id', hotelId)
    .eq('direction', 'export')

  const existingRoomIds = new Set((existing ?? []).map((row) => row.room_id).filter(Boolean))

  const toInsert = rooms
    .filter((room) => !existingRoomIds.has(room.id))
    .map((room) => ({
      hotel_id: hotelId,
      room_id: room.id,
      name: `Room ${room.number} — Export`,
      provider: 'other' as const,
      direction: 'export' as const,
      is_active: true,
    }))

  if (toInsert.length === 0) return

  await admin.from('channel_ical_feeds').insert(toInsert)
}
