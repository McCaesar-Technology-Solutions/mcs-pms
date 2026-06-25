import { createAdminClient } from '@/lib/supabase/admin'
import { generateICalFeed } from '@/lib/ical/generate'

interface ExportFeedRow {
  id: string
  hotel_id: string
  room_id: string | null
  name: string
}

export async function buildExportICalForFeed(feed: ExportFeedRow): Promise<string | null> {
  const admin = createAdminClient()

  let query = admin
    .from('reservations')
    .select('id, guest_name, check_in, check_out, room_id, status')
    .eq('hotel_id', feed.hotel_id)
    .in('status', ['confirmed', 'checked_in'])
    .gte('check_out', new Date().toISOString().split('T')[0])

  if (feed.room_id) {
    query = query.eq('room_id', feed.room_id)
  }

  const { data: reservations } = await query.order('check_in', { ascending: true })

  const events = (reservations ?? []).map((row) => ({
    uid: `mojo-res-${row.id}@pms`,
    summary: `Reserved — ${row.guest_name}`,
    dtstart: row.check_in,
    dtend: row.check_out,
  }))

  return generateICalFeed({ name: feed.name, events })
}

export async function loadExportFeedByToken(token: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('channel_ical_feeds')
    .select('id, hotel_id, room_id, name, direction, is_active')
    .eq('export_token', token)
    .maybeSingle()

  if (!data || data.direction !== 'export' || !data.is_active) return null
  return data
}
