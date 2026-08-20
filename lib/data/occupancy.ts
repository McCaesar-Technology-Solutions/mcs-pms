import {
  canExtendStay,
  INDEFINITE_OCCUPANCY_STATUSES,
  OCCUPANCY_BLOCKING_STATUSES,
  STALE_IN_HOUSE_STATUSES,
} from '@/lib/reservations/lifecycle'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Unified room-occupancy layer. A room is unavailable for a date window when
 * EITHER an active reservation (confirmed / checked_in) OR an enrolled guest
 * stay overlaps that window. Both the reservations flow and the guest
 * enrollment flow consult these helpers so the two can never clash.
 *
 * Date semantics: check_in / check_out are stored as `YYYY-MM-DD`. Two windows
 * overlap when `aIn < bOut && aOut > bIn` — i.e. same-day turnover (one party
 * checks out the morning another checks in) is allowed.
 */

type Client = SupabaseClient<Database>

const BLOCKING_RESERVATION_STATUSES = OCCUPANCY_BLOCKING_STATUSES
const INDEFINITE_BLOCKING_STATUSES = INDEFINITE_OCCUPANCY_STATUSES

export interface OccupancySpan {
  roomId: string
  checkIn: string
  checkOut: string
  kind: 'reservation' | 'guest'
}

export interface RoomRef {
  id: string
  number: string
  floor?: number | null
}

export interface ClashOptions {
  excludeReservationId?: string
  excludeGuestId?: string
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function tomorrowISO(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

function addDayISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

/**
 * Date window used when moving an occupying stay. Overstay / stale in-house
 * check-out is in the past, so clash checks must still cover today onward.
 */
export function occupancyWindowForCurrentStay(
  checkIn: string,
  checkOut: string,
  status: string | null | undefined,
  today = todayISO(),
): { checkIn: string; checkOut: string } {
  if (checkOut > today) return { checkIn, checkOut }
  if (canExtendStay(status) || status === 'dispute_hold') {
    return { checkIn, checkOut: addDayISO(today) }
  }
  return { checkIn, checkOut }
}

/**
 * Rooms held by a guest who has not actually left (overstay / dispute hold, or
 * stale checked_in after a missed cron). Their stored check_out may be in the
 * past, so date-range overlap alone misses them — block from today onward.
 */
async function roomsWithIndefiniteOccupant(
  client: Client,
  hotelId: string,
  opts: { roomId?: string; excludeReservationId?: string } = {},
): Promise<Set<string>> {
  const today = todayISO()
  const taken = new Set<string>()

  let indefiniteQuery = client
    .from('reservations')
    .select('id, room_id')
    .eq('hotel_id', hotelId)
    .in('status', INDEFINITE_BLOCKING_STATUSES)
  if (opts.roomId) indefiniteQuery = indefiniteQuery.eq('room_id', opts.roomId)
  if (opts.excludeReservationId) indefiniteQuery = indefiniteQuery.neq('id', opts.excludeReservationId)

  let staleQuery = client
    .from('reservations')
    .select('id, room_id')
    .eq('hotel_id', hotelId)
    .in('status', STALE_IN_HOUSE_STATUSES)
    .lt('check_out', today)
  if (opts.roomId) staleQuery = staleQuery.eq('room_id', opts.roomId)
  if (opts.excludeReservationId) staleQuery = staleQuery.neq('id', opts.excludeReservationId)

  let noShowHoldQuery = client
    .from('reservations')
    .select('id, room_id')
    .eq('hotel_id', hotelId)
    .eq('status', 'no_show')
    .not('room_id', 'is', null)
    .gte('room_held_until', today)
  if (opts.roomId) noShowHoldQuery = noShowHoldQuery.eq('room_id', opts.roomId)
  if (opts.excludeReservationId) noShowHoldQuery = noShowHoldQuery.neq('id', opts.excludeReservationId)

  const [{ data: indefinite }, { data: stale }, { data: noShowHeld }] = await Promise.all([
    indefiniteQuery,
    staleQuery,
    noShowHoldQuery,
  ])
  for (const r of [...(indefinite ?? []), ...(stale ?? []), ...(noShowHeld ?? [])]) {
    if (!r.room_id) continue
    if (opts.excludeReservationId && r.id === opts.excludeReservationId) continue
    if (opts.roomId && r.room_id !== opts.roomId) continue
    taken.add(r.room_id)
  }
  return taken
}

export function datesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && aOut > bIn
}

export interface OccupancyToday {
  occupied: number
  total: number
  percent: number
}

/**
 * Live occupancy for today: the share of rooms taken right now by an active
 * reservation or guest stay (a span covering today). Powers the sidebar meter.
 */
export async function getOccupancyToday(client: Client, hotelId: string): Promise<OccupancyToday> {
  const today = todayISO()
  const [{ count }, spans] = await Promise.all([
    client.from('rooms').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    getOccupancySpans(client, hotelId),
  ])

  const total = count ?? 0
  const occupiedRoomIds = new Set<string>()
  for (const span of spans) {
    if (span.checkIn <= today && span.checkOut > today) occupiedRoomIds.add(span.roomId)
  }
  const occupied = Math.min(occupiedRoomIds.size, total)
  const percent = total > 0 ? Math.round((occupied / total) * 100) : 0
  return { occupied, total, percent }
}

/**
 * All current + future occupancy windows for a hotel, merged from reservations
 * and guest stays. Past windows (check_out before today) are skipped — they no
 * longer affect availability. Used to drive live client-side availability.
 */
export async function getOccupancySpans(client: Client, hotelId: string): Promise<OccupancySpan[]> {
  const today = todayISO()
  const tomorrow = tomorrowISO()
  const [reservationsRes, guestsRes, indefiniteRes, staleInHouseRes, noShowHoldRes] = await Promise.all([
    client
      .from('reservations')
      .select('room_id, check_in, check_out')
      .eq('hotel_id', hotelId)
      .in('status', BLOCKING_RESERVATION_STATUSES)
      .gte('check_out', today),
    client
      .from('guests')
      .select('room_id, check_in, check_out')
      .eq('hotel_id', hotelId)
      .gte('check_out', today),
    client
      .from('reservations')
      .select('room_id, check_in')
      .eq('hotel_id', hotelId)
      .in('status', INDEFINITE_BLOCKING_STATUSES),
    client
      .from('reservations')
      .select('room_id, check_in')
      .eq('hotel_id', hotelId)
      .in('status', STALE_IN_HOUSE_STATUSES)
      .lt('check_out', today),
    client
      .from('reservations')
      .select('room_id, check_in')
      .eq('hotel_id', hotelId)
      .eq('status', 'no_show')
      .not('room_id', 'is', null)
      .gte('room_held_until', today),
  ])

  const spans: OccupancySpan[] = []
  for (const r of reservationsRes.data ?? []) {
    if (r.room_id && r.check_in && r.check_out) {
      spans.push({ roomId: r.room_id, checkIn: r.check_in, checkOut: r.check_out, kind: 'reservation' })
    }
  }
  for (const g of guestsRes.data ?? []) {
    if (g.room_id && g.check_in && g.check_out) {
      spans.push({ roomId: g.room_id, checkIn: g.check_in, checkOut: g.check_out, kind: 'guest' })
    }
  }
  // Overstay / dispute-hold / stale in-house: guest still in the room despite a
  // past check_out. Surface them as occupied through today for the meter.
  for (const r of [
    ...(indefiniteRes.data ?? []),
    ...(staleInHouseRes.data ?? []),
    ...(noShowHoldRes.data ?? []),
  ]) {
    if (r.room_id) {
      const checkIn = r.check_in && r.check_in < today ? r.check_in : today
      spans.push({ roomId: r.room_id, checkIn, checkOut: tomorrow, kind: 'reservation' })
    }
  }
  return spans
}

/**
 * True if a room is already taken (reservation OR guest) for the given window.
 * `excludeReservationId` / `excludeGuestId` let an existing record skip itself
 * when being edited.
 */
export async function roomHasClash(
  client: Client,
  hotelId: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  opts: ClashOptions = {},
): Promise<boolean> {
  let reservationQuery = client
    .from('reservations')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('room_id', roomId)
    .in('status', BLOCKING_RESERVATION_STATUSES)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .limit(1)
  if (opts.excludeReservationId) reservationQuery = reservationQuery.neq('id', opts.excludeReservationId)

  let guestQuery = client
    .from('guests')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('room_id', roomId)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .limit(1)
  if (opts.excludeGuestId) guestQuery = guestQuery.neq('id', opts.excludeGuestId)

  const [{ data: reservationData }, { data: guestData }] = await Promise.all([
    reservationQuery,
    guestQuery,
  ])
  if ((reservationData?.length ?? 0) > 0 || (guestData?.length ?? 0) > 0) return true

  // A room with an overstay/dispute-hold occupant is unavailable for any window
  // that reaches today or the future, regardless of the occupant's stale dates.
  if (checkOut > todayISO()) {
    const indefinite = await roomsWithIndefiniteOccupant(client, hotelId, {
      roomId,
      excludeReservationId: opts.excludeReservationId,
    })
    if (indefinite.has(roomId)) return true
  }

  return false
}

/**
 * Rooms that are free across BOTH reservations and guest stays for the window.
 */
export async function findAvailableRooms(
  client: Client,
  hotelId: string,
  checkIn: string,
  checkOut: string,
  opts: ClashOptions = {},
): Promise<RoomRef[]> {
  const takenRoomIds = await (async () => {
    let reservationQuery = client
      .from('reservations')
      .select('id, room_id')
      .eq('hotel_id', hotelId)
      .in('status', BLOCKING_RESERVATION_STATUSES)
      .lt('check_in', checkOut)
      .gt('check_out', checkIn)
    if (opts.excludeReservationId) reservationQuery = reservationQuery.neq('id', opts.excludeReservationId)

    let guestQuery = client
      .from('guests')
      .select('id, room_id')
      .eq('hotel_id', hotelId)
      .lt('check_in', checkOut)
      .gt('check_out', checkIn)
    if (opts.excludeGuestId) guestQuery = guestQuery.neq('id', opts.excludeGuestId)

    const [{ data: reservationData }, { data: guestData }] = await Promise.all([
      reservationQuery,
      guestQuery,
    ])
    const taken = new Set<string>()
    for (const r of reservationData ?? []) if (r.room_id) taken.add(r.room_id)
    for (const g of guestData ?? []) if (g.room_id) taken.add(g.room_id)

    if (checkOut > todayISO()) {
      const indefinite = await roomsWithIndefiniteOccupant(client, hotelId, {
        excludeReservationId: opts.excludeReservationId,
      })
      for (const id of indefinite) taken.add(id)
    }
    return taken
  })()

  const { data: rooms } = await client
    .from('rooms')
    .select('id, number')
    .eq('hotel_id', hotelId)
    .order('number')

  return ((rooms ?? []) as RoomRef[]).filter((r) => !takenRoomIds.has(r.id))
}
