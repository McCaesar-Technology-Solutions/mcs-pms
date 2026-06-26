import type { SupabaseClient } from '@supabase/supabase-js'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Unbilled folio subtotals keyed by `guestId:reservationId` or `guestId:` for guest-level charges.
 */
export async function loadFolioSubtotalMap(
  admin: SupabaseClient,
  hotelId: string,
  guestIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const uniqueGuestIds = [...new Set(guestIds.filter(Boolean))]
  if (!uniqueGuestIds.length) return map

  const { data } = await admin
    .from('guest_charges')
    .select('guest_id, reservation_id, amount')
    .eq('hotel_id', hotelId)
    .in('guest_id', uniqueGuestIds)
    .is('invoice_id', null)

  for (const row of data ?? []) {
    const guestId = row.guest_id as string
    const key = row.reservation_id ? `${guestId}:${row.reservation_id}` : `${guestId}:`
    const amount = Number(row.amount ?? 0)
    map.set(key, round2((map.get(key) ?? 0) + amount))
  }

  return map
}

/** Matches loadUnbilledFolioCharges scope for an in-house stay. */
export function folioSubtotalForStay(
  folioMap: Map<string, number>,
  guestId: string | null | undefined,
  reservationId: string,
): number {
  if (!guestId) return 0
  const specific = folioMap.get(`${guestId}:${reservationId}`) ?? 0
  const guestLevel = folioMap.get(`${guestId}:`) ?? 0
  return round2(specific + guestLevel)
}
