import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRoomNumber } from '@/lib/guest-portal'
import { todayISO } from '@/lib/stays/helpers'
import type { Guest } from '@/types'

export interface ActiveGuestRoomMatch {
  guest: Guest
  roomNumber: string
}

/**
 * Find the guest currently staying in a room (checked in, not checked out).
 * Used when a guest scans the property QR and enters their room number.
 */
export async function findActiveGuestForRoom(
  hotelId: string,
  roomNumberInput: string,
  guestLastName?: string,
): Promise<ActiveGuestRoomMatch | null> {
  const normalized = normalizeRoomNumber(roomNumberInput)
  if (!normalized) return null

  const admin = createAdminClient()
  const { data: rooms } = await admin.from('rooms').select('id, number').eq('hotel_id', hotelId)

  const room = (rooms ?? []).find((r) => normalizeRoomNumber(r.number) === normalized)
  if (!room) return null

  const today = todayISO()
  const { data: guests } = await admin
    .from('guests')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('room_id', room.id)
    .lte('check_in', today)
    .gt('check_out', today)
    .order('created_at', { ascending: false })

  if (!guests?.length) return null

  const now = new Date()
  const active = guests.find(
    (g) => !g.token_expires_at || new Date(g.token_expires_at) > now,
  )
  if (!active) return null

  if (guestLastName?.trim()) {
    const normalizedLast = guestLastName.trim().toLowerCase()
    const guestLast = active.name.trim().split(/\s+/).pop()?.toLowerCase() ?? ''
    if (guestLast !== normalizedLast) return null
  }

  return { guest: active as Guest, roomNumber: room.number }
}
