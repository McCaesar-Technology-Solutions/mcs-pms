import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePortalPin } from '@/lib/guest/portal-pin'
import { normalizeRoomNumber } from '@/lib/guest-portal'
import { todayISO } from '@/lib/stays/helpers'
import type { Guest } from '@/types'

export interface ActiveGuestRoomMatch {
  guest: Guest
  roomNumber: string
}

/**
 * Find the guest currently staying in a room (checked in, not checked out).
 * Used when a guest scans the property QR and enters their room number plus
 * the portal PIN issued by the front desk at check-in.
 */
export async function findActiveGuestForRoom(
  hotelId: string,
  roomNumberInput: string,
  portalPin: string,
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

  // PIN is the authentication factor — no PIN on record means no self-service
  // entry (the guest can still use the magic link from the front desk).
  const pin = normalizePortalPin(portalPin)
  if (!active.portal_pin || pin.length === 0 || active.portal_pin !== pin) return null

  return { guest: active as Guest, roomNumber: room.number }
}
