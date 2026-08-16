import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { datesOverlap, type RoomRef } from '@/lib/data/occupancy'
import { floorLabel } from '@/lib/data/front-desk-ops'
import { OCCUPANCY_BLOCKING_STATUSES, OCCUPYING_STATUSES, isOccupyingReservationStatus } from '@/lib/reservations/lifecycle'
import type { Reservation } from '@/types'

type Client = SupabaseClient<Database>

const DATED_TIMELINE_STATUSES = OCCUPANCY_BLOCKING_STATUSES
const RESERVATION_TIMELINE_SELECT =
  'id, room_id, check_in, check_out, guest_name, channel, guest_id, status, rooms(number)' as const

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

function tomorrowISO(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Keep a still-occupying stay visible on today when stored check-out is in the past. */
export function extendStayThroughToday(checkOut: string, today: string): string {
  return checkOut > today ? checkOut : tomorrowISO(today)
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

  const [roomsRes, datedRes, occupyingRes, guestsRes] = await Promise.all([
    client.from('rooms').select('id, number, floor').eq('hotel_id', hotelId).order('number'),
    client
      .from('reservations')
      .select(RESERVATION_TIMELINE_SELECT)
      .eq('hotel_id', hotelId)
      .in('status', [...DATED_TIMELINE_STATUSES])
      .gte('check_out', today),
    client
      .from('reservations')
      .select(RESERVATION_TIMELINE_SELECT)
      .eq('hotel_id', hotelId)
      .in('status', [...OCCUPYING_STATUSES]),
    client
      .from('guests')
      .select('id, room_id, check_in, check_out, name, rooms(number)')
      .eq('hotel_id', hotelId)
      .not('room_id', 'is', null),
  ])

  const rooms = (roomsRes.data ?? []) as RoomRef[]
  const bars: OccupancyTimelineBar[] = []
  const seenReservationIds = new Set<string>()

  for (const row of [...(occupyingRes.data ?? []), ...(datedRes.data ?? [])]) {
    if (!row.id || seenReservationIds.has(row.id)) continue
    if (!row.room_id || !row.check_in || !row.check_out) continue
    seenReservationIds.add(row.id)
    const occupying = isOccupyingReservationStatus(row.status)
    if (!occupying && row.check_out < today) continue
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
      checkOut: occupying ? extendStayThroughToday(row.check_out, today) : row.check_out,
      source: reservationSource(row.channel),
      kind: 'reservation',
    })
  }

  for (const row of guestsRes.data ?? []) {
    if (!row.room_id || !row.check_in || !row.check_out) continue
    const guestCheckIn = row.check_in
    const guestCheckOut = extendStayThroughToday(row.check_out, today)

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

export function groupTimelineRoomsByFloor(
  rooms: RoomRef[],
): { floor: number; rooms: RoomRef[] }[] {
  const byFloor = new Map<number, RoomRef[]>()
  for (const room of rooms) {
    const floor = room.floor ?? 0
    const list = byFloor.get(floor) ?? []
    list.push(room)
    byFloor.set(floor, list)
  }

  return [...byFloor.entries()]
    .sort(([a], [b]) => b - a)
    .map(([floor, floorRooms]) => ({
      floor,
      rooms: floorRooms.sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      ),
    }))
}

export function summarizeTimelineFloor(
  floor: number,
  floorRooms: RoomRef[],
  bars: OccupancyTimelineBar[],
  today: string,
): { floor: number; label: string; total: number; bookedToday: number } {
  let bookedToday = 0
  for (const room of floorRooms) {
    if (barForRoomOnDate(bars, room.id, today)) bookedToday += 1
  }
  return {
    floor,
    label: floorLabel(floor),
    total: floorRooms.length,
    bookedToday,
  }
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
