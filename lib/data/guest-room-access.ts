import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePortalPin } from '@/lib/guest/portal-pin'
import { hashPortalPin, verifyPortalPin } from '@/lib/guest/portal-pin-crypto'
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

  const pin = normalizePortalPin(portalPin)
  if (!pin) return null

  const admin = createAdminClient()
  const { data: rooms } = await admin.from('rooms').select('id, number').eq('hotel_id', hotelId)

  const room = (rooms ?? []).find((r) => normalizeRoomNumber(r.number) === normalized)
  if (!room) return null

  const today = todayISO()
  const { data: guests } = await admin
    .from('guests')
    .select('*, portal_pin_hash')
    .eq('hotel_id', hotelId)
    .eq('room_id', room.id)
    .lte('check_in', today)
    .gt('check_out', today)
    .order('created_at', { ascending: false })

  if (!guests?.length) return null

  const now = new Date()
  let matched: (typeof guests)[number] | null = null

  for (const guest of guests) {
    if (guest.token_expires_at && new Date(guest.token_expires_at) <= now) continue

    const row = guest as Guest & { portal_pin_hash?: string | null }
    const hasCredential = Boolean(row.portal_pin_hash || row.portal_pin)
    if (!hasCredential) continue

    const ok = await verifyPortalPin(row.id, pin, row.portal_pin_hash, row.portal_pin)
    if (!ok) continue

    matched = guest

    // Upgrade legacy plaintext PIN to hash and clear plaintext.
    if (!row.portal_pin_hash && row.portal_pin) {
      const portal_pin_hash = await hashPortalPin(row.id, pin)
      await admin
        .from('guests')
        .update({ portal_pin_hash, portal_pin: null })
        .eq('id', row.id)
    }
    break
  }

  if (!matched) return null

  return { guest: matched as Guest, roomNumber: room.number }
}

/** Persist a newly issued portal PIN (hash only). */
export async function storeGuestPortalPin(guestId: string, pin: string): Promise<void> {
  const admin = createAdminClient()
  const portal_pin_hash = await hashPortalPin(guestId, pin)
  await admin.from('guests').update({ portal_pin_hash, portal_pin: null }).eq('id', guestId)
}
