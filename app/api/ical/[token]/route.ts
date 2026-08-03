import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAvailabilityIcs, ICAL_EXPORT_STATUSES } from '@/lib/ical/export'
import { hotelTodayISO, normalizeHotelTimezone } from '@/lib/hotel-time'

export const runtime = 'nodejs'

function normalizeToken(raw: string): string {
  return raw.replace(/\.ics$/i, '').trim()
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await context.params
  const token = normalizeToken(rawToken)
  if (!token || token.length < 16 || token.length > 128) {
    return new NextResponse('Not found', { status: 404 })
  }

  const admin = createAdminClient()
  const { data: feed } = await admin
    .from('channel_ical_feeds')
    .select('id, hotel_id, room_id, name, direction, is_active')
    .eq('export_token', token)
    .eq('direction', 'export')
    .eq('is_active', true)
    .maybeSingle()

  if (!feed?.room_id) {
    return new NextResponse('Not found', { status: 404 })
  }

  const [{ data: hotel }, { data: room }, { data: importFeed }] = await Promise.all([
    admin.from('hotels').select('name, timezone').eq('id', feed.hotel_id).maybeSingle(),
    admin.from('rooms').select('number').eq('id', feed.room_id).maybeSingle(),
    admin
      .from('channel_ical_feeds')
      .select('id')
      .eq('hotel_id', feed.hotel_id)
      .eq('room_id', feed.room_id)
      .eq('direction', 'import')
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const tz = normalizeHotelTimezone(hotel?.timezone)
  const today = hotelTodayISO(tz)

  const { data: reservations } = await admin
    .from('reservations')
    .select('id, guest_name, check_in, check_out, status, channel, ical_uid, ical_feed_id')
    .eq('hotel_id', feed.hotel_id)
    .eq('room_id', feed.room_id)
    .in('status', [...ICAL_EXPORT_STATUSES])
    .gte('check_out', today)

  const calendarName =
    feed.name ||
    `${hotel?.name ?? 'MOJO'} · Room ${room?.number ?? ''}`.trim()

  const ics = buildAvailabilityIcs({
    calendarName,
    reservations: reservations ?? [],
    excludeImportFeedId: importFeed?.id ?? null,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="mojo-${token.slice(0, 8)}.ics"`,
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
