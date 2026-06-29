import type { SupabaseClient } from '@supabase/supabase-js'

const OPEN_STAY_STATUSES = ['checked_in', 'overstay', 'checkout_in_progress'] as const

export async function findActiveReservationForGuest(
  admin: SupabaseClient,
  hotelId: string,
  guestId: string,
): Promise<{ id: string; folio_locked: boolean; status: string | null } | null> {
  const { data } = await admin
    .from('reservations')
    .select('id, folio_locked, status')
    .eq('hotel_id', hotelId)
    .eq('guest_id', guestId)
    .in('status', [...OPEN_STAY_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

export async function isFolioPostingBlocked(
  admin: SupabaseClient,
  hotelId: string,
  guestId: string,
  reservationId?: string | null,
): Promise<{ blocked: boolean; reservationId?: string }> {
  if (reservationId) {
    const { data } = await admin
      .from('reservations')
      .select('id, folio_locked, status')
      .eq('id', reservationId)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (data?.folio_locked) {
      return { blocked: true, reservationId: data.id }
    }
    return { blocked: false, reservationId: data?.id }
  }

  const active = await findActiveReservationForGuest(admin, hotelId, guestId)
  if (active?.folio_locked) {
    return { blocked: true, reservationId: active.id }
  }
  return { blocked: false, reservationId: active?.id }
}
