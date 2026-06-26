import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { datesOverlap, type RoomRef } from '@/lib/data/occupancy'
import { OCCUPANCY_BLOCKING_STATUSES } from '@/lib/reservations/lifecycle'
import type { Reservation } from '@/types'

type Client = SupabaseClient<Database>

const BLOCKING_RESERVATION_STATUSES = OCCUPANCY_BLOCKING_STATUSES

const CHANNEL_SOURCE_MAP: Record<string, Reservation['source']> = {
  airbnb: 'airbnb',
  booking_com: 'booking',
  direct: 'website',
  walk_in: 'walk_in',
  other: 'other',
}

export type TimelineBarSource = Reservation['source'] | 'in_house'

export interface OccupancyTimelineBar {
  id: string
  roomId: string
  roomNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  source: TimelineBarSource
  kind: 'reservation' | 'guest'
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** A guest occupies the room on `date` when check-in ≤ date < check-out. */
export function stayCoversDate(checkIn: string, checkOut: string, date: string): boolean {
  return checkIn <= date && checkOut > date
}

/** List each calendar date from check-in up to (but not including) check-out. */
export function stayDates(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  const cursor = new Date(checkIn + 'T12:00:00')
  const end = new Date(checkOut + 'T12:00:00')
  while (cursor < end) {
    out.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return stayDates(checkIn, checkOut).length
}

function reservationSource(channel: string | null): TimelineBarSource {
  return CHANNEL_SOURCE_MAP[channel ?? ''] ?? 'other'
}

/**
 * Unified occupancy bars for the timeline: reservations + guest-only stays,
 * deduplicated so check-ins linked to a reservation are not shown twice.
 */
export async function getOccupancyTimelineBars(
  client: Client,
  hotelId: string,
): Promise<{ rooms: RoomRef[]; bars: OccupancyTimelineBar[] }> {
  const today = todayISO()

  const [roomsRes, reservationsRes, guestsRes] = await Promise.all([
    client.from('rooms').select('id, number').eq('hotel_id', hotelId).order('number'),
    client
      .from('reservations')
      .select('id, room_id, check_in, check_out, guest_name, channel, guest_id, rooms(number)')
      .eq('hotel_id', hotelId)
      .in('status', BLOCKING_RESERVATION_STATUSES)
      .gte('check_out', today),
    client
      .from('guests')
      .select('id, room_id, check_in, check_out, name, rooms(number)')
      .eq('hotel_id', hotelId)
      .gte('check_out', today),
  ])

  const rooms = (roomsRes.data ?? []) as RoomRef[]
  const bars: OccupancyTimelineBar[] = []

  for (const row of reservationsRes.data ?? []) {
    if (!row.room_id || !row.check_in || !row.check_out) continue
    const roomNumber =
      row.rooms && typeof row.rooms === 'object' && 'number' in row.rooms
        ? String((row.rooms as { number: string }).number)
        : '—'
    bars.push({
      id: `res-${row.id}`,
      roomId: row.room_id,
      roomNumber,
      guestName: row.guest_name,
      checkIn: row.check_in,
      checkOut: row.check_out,
      source: reservationSource(row.channel),
      kind: 'reservation',
    })
  }

  for (const row of guestsRes.data ?? []) {
    if (!row.room_id || !row.check_in || !row.check_out) continue
    const guestCheckIn = row.check_in
    const guestCheckOut = row.check_out

    const overlapsReservation = bars.some(
      (bar) =>
        bar.roomId === row.room_id &&
        datesOverlap(bar.checkIn, bar.checkOut, guestCheckIn, guestCheckOut),
    )
    if (overlapsReservation) continue

    const roomNumber =
      row.rooms && typeof row.rooms === 'object' && 'number' in row.rooms
        ? String((row.rooms as { number: string }).number)
        : '—'

    bars.push({
      id: `guest-${row.id}`,
      roomId: row.room_id,
      roomNumber,
      guestName: row.name,
      checkIn: guestCheckIn,
      checkOut: guestCheckOut,
      source: 'in_house',
      kind: 'guest',
    })
  }

  return { rooms, bars }
}

export function barForRoomOnDate(
  bars: OccupancyTimelineBar[],
  roomId: string,
  date: string,
): OccupancyTimelineBar | null {
  return bars.find((bar) => bar.roomId === roomId && stayCoversDate(bar.checkIn, bar.checkOut, date)) ?? null
}

export function isFirstVisibleStayDate(
  bar: OccupancyTimelineBar,
  date: string,
  rangeStart: string,
): boolean {
  const first = bar.checkIn < rangeStart ? rangeStart : bar.checkIn
  return date === first
}
