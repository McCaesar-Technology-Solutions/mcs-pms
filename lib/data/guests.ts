import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import type { DbReservation, ReservationChannel } from '@/types'

export type GuestStatus = 'active' | 'vip' | 'returning' | 'new'

export interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  roomNumber: string | null
  roomId: string | null
  checkIn: string | null
  checkOut: string | null
  totalStays: number
  totalSpent: number
  lastStay: string | null
  status: GuestStatus
  source: ReservationChannel | null
  token: string | null
  tokenExpiresAt: string | null
  reservationId: string | null
  isInHouse: boolean
}

interface GuestQueryRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  room_id: string | null
  check_in: string | null
  check_out: string | null
  created_at: string | null
  token: string | null
  token_expires_at: string | null
  rooms?: { number: string } | null
}

const VIP_SPEND_THRESHOLD = 5000
const VIP_STAYS_THRESHOLD = 4

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function deriveStatus(
  stays: number,
  spent: number,
  isCurrentlyStaying: boolean,
): GuestStatus {
  if (isCurrentlyStaying) return 'active'
  if (spent >= VIP_SPEND_THRESHOLD || stays >= VIP_STAYS_THRESHOLD) return 'vip'
  if (stays >= 2) return 'returning'
  return 'new'
}

export async function getGuestsData(): Promise<GuestRow[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const supabase = await createClient()
  const hotelId = profile.hotel_id

  const [guestsRes, reservationsRes] = await Promise.all([
    supabase
      .from('guests')
      .select(
        'id, name, email, phone, room_id, check_in, check_out, created_at, token, token_expires_at, rooms(number)',
      )
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false }),
    supabase
      .from('reservations')
      .select('*')
      .eq('hotel_id', hotelId),
  ])

  const guests = (guestsRes.data ?? []) as unknown as GuestQueryRow[]
  const reservations = (reservationsRes.data ?? []) as DbReservation[]

  const byGuest = new Map<string, DbReservation[]>()
  for (const res of reservations) {
    if (!res.guest_id) continue
    const list = byGuest.get(res.guest_id) ?? []
    list.push(res)
    byGuest.set(res.guest_id, list)
  }

  const today = todayStr()

  return guests.map((guest) => {
    const resList = (byGuest.get(guest.id) ?? []).filter((r) => r.status !== 'cancelled')

    const stays = resList.length > 0 ? resList.length : guest.check_in ? 1 : 0
    const totalSpent = resList.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

    const checkOuts = [
      ...resList.map((r) => r.check_out),
      guest.check_out,
    ].filter((d): d is string => Boolean(d))
    const lastStay = checkOuts.length > 0 ? checkOuts.sort().at(-1) ?? null : null

    const isCurrentlyStaying =
      resList.some((r) => r.status === 'checked_in') ||
      Boolean(guest.check_in && guest.check_out && guest.check_in <= today && guest.check_out >= today)

    const activeReservation = resList.find((r) => r.status === 'checked_in') ?? null

    const latestRes = resList
      .slice()
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .at(-1)

    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      roomNumber: guest.rooms?.number ?? null,
      roomId: guest.room_id,
      checkIn: guest.check_in,
      checkOut: guest.check_out,
      totalStays: stays,
      totalSpent,
      lastStay,
      status: deriveStatus(stays, totalSpent, isCurrentlyStaying),
      source: activeReservation?.channel ?? latestRes?.channel ?? null,
      token: guest.token,
      tokenExpiresAt: guest.token_expires_at,
      reservationId: activeReservation?.id ?? null,
      isInHouse: isCurrentlyStaying,
    }
  })
}
