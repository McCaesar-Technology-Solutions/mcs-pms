'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ReservationChannel, ReservationStatus } from '@/types'

export type ReservationActionResult = { success: true } | { success: false; error: string }

export interface RoomSuggestion {
  id: string
  number: string
}

export type CreateReservationResult =
  | { success: true }
  | { success: false; error: string; suggestions?: RoomSuggestion[] }

const VALID_CHANNELS: ReservationChannel[] = [
  'airbnb',
  'booking_com',
  'direct',
  'walk_in',
  'other',
]

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, profile }
}

function revalidateReservationViews() {
  revalidatePath('/owner/reservations')
  revalidatePath('/manager/reservations')
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
}

function nights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
}

async function findAvailableRooms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hotelId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string,
): Promise<RoomSuggestion[]> {
  const [{ data: rooms }, clashes] = await Promise.all([
    supabase.from('rooms').select('id, number').eq('hotel_id', hotelId).order('number'),
    (async () => {
      let query = supabase
        .from('reservations')
        .select('room_id')
        .eq('hotel_id', hotelId)
        .neq('status', 'cancelled')
        .lt('check_in', checkOut)
        .gt('check_out', checkIn)
      if (excludeReservationId) query = query.neq('id', excludeReservationId)
      const { data } = await query
      return data
    })(),
  ])

  const takenRoomIds = new Set((clashes ?? []).map((r) => r.room_id).filter(Boolean))
  return (rooms ?? []).filter((r) => !takenRoomIds.has(r.id))
}

async function roomHasClash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string,
): Promise<boolean> {
  let query = supabase
    .from('reservations')
    .select('id')
    .eq('room_id', roomId)
    .neq('status', 'cancelled')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .limit(1)
  if (excludeReservationId) query = query.neq('id', excludeReservationId)
  const { data } = await query
  return (data ?? []).length > 0
}

export async function createReservation(input: {
  room_id: string
  guest_name: string
  check_in: string
  check_out: string
  channel: ReservationChannel
  nightly_rate: number
}): Promise<CreateReservationResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }
  if (!input.guest_name.trim()) return { success: false, error: 'Guest name is required.' }
  if (!input.room_id) return { success: false, error: 'Select a room.' }
  if (!input.check_in || !input.check_out) return { success: false, error: 'Dates are required.' }
  if (input.check_out <= input.check_in) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }
  if (!VALID_CHANNELS.includes(input.channel)) return { success: false, error: 'Invalid channel.' }

  if (await roomHasClash(supabase, input.room_id, input.check_in, input.check_out)) {
    const suggestions = await findAvailableRooms(
      supabase,
      profile.hotel_id,
      input.check_in,
      input.check_out,
    )
    return {
      success: false,
      error: 'That room is already booked for these dates.',
      suggestions,
    }
  }

  const total = input.nightly_rate * nights(input.check_in, input.check_out)

  const { error } = await supabase.from('reservations').insert({
    hotel_id: profile.hotel_id,
    room_id: input.room_id,
    guest_name: input.guest_name.trim(),
    check_in: input.check_in,
    check_out: input.check_out,
    status: 'confirmed',
    channel: input.channel,
    nightly_rate: input.nightly_rate,
    total_amount: total,
    created_by: profile.id,
  })

  if (error) return { success: false, error: error.message }

  revalidateReservationViews()
  return { success: true }
}

export async function updateReservation(
  id: string,
  input: {
    room_id?: string
    guest_name?: string
    check_in?: string
    check_out?: string
    channel?: ReservationChannel
    nightly_rate?: number
  },
): Promise<ReservationActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const payload: {
    room_id?: string
    guest_name?: string
    check_in?: string
    check_out?: string
    channel?: ReservationChannel
    nightly_rate?: number
    total_amount?: number
  } = {}
  if (input.room_id !== undefined) payload.room_id = input.room_id
  if (input.guest_name !== undefined) {
    if (!input.guest_name.trim()) return { success: false, error: 'Guest name is required.' }
    payload.guest_name = input.guest_name.trim()
  }
  if (input.check_in !== undefined) payload.check_in = input.check_in
  if (input.check_out !== undefined) payload.check_out = input.check_out
  if (input.channel !== undefined) payload.channel = input.channel
  if (input.nightly_rate !== undefined) payload.nightly_rate = input.nightly_rate

  const checkIn = payload.check_in
  const checkOut = payload.check_out
  if (checkIn && checkOut && checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  if (input.nightly_rate !== undefined && checkIn && checkOut) {
    payload.total_amount = input.nightly_rate * nights(checkIn, checkOut)
  }

  const { error } = await supabase.from('reservations').update(payload).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateReservationViews()
  return { success: true }
}

async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  roomStatus?: 'occupied' | 'cleaning' | 'available',
): Promise<ReservationActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('room_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('reservations').update({ status }).eq('id', id)
  if (error) return { success: false, error: error.message }

  if (roomStatus && reservation?.room_id) {
    await supabase
      .from('rooms')
      .update({ status: roomStatus, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', reservation.room_id)
  }

  revalidateReservationViews()
  return { success: true }
}

export async function checkInReservation(id: string): Promise<ReservationActionResult> {
  return setReservationStatus(id, 'checked_in', 'occupied')
}

export async function checkOutReservation(id: string): Promise<ReservationActionResult> {
  return setReservationStatus(id, 'checked_out', 'cleaning')
}

export async function cancelReservation(id: string): Promise<ReservationActionResult> {
  return setReservationStatus(id, 'cancelled')
}
