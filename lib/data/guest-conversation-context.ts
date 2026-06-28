import { createAdminClient } from '@/lib/supabase/admin'

export interface GuestConversationContext {
  guestId: string
  guestName: string
  guestPhone: string | null
  guestEmail: string | null
  roomNumber: string | null
  roomId: string | null
  reservationId: string | null
  checkInDate: string | null
  checkOutDate: string | null
  reservationStatus: string | null
  paymentStatus: string | null
}

export async function loadGuestConversationContext(
  conversationId: string,
): Promise<GuestConversationContext | null> {
  const admin = createAdminClient()
  const { data: conv } = await admin
    .from('guest_conversations')
    .select('guest_id, guests(id, name, phone, email, room_id, check_in, check_out, rooms(number))')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv) return null

  const guest = conv.guests as {
    id?: string
    name?: string
    phone?: string | null
    email?: string | null
    room_id?: string | null
    check_in?: string | null
    check_out?: string | null
    rooms?: { number?: string } | null
  } | null

  if (!guest?.id) return null

  const { data: reservations } = await admin
    .from('reservations')
    .select('id, check_in, check_out, status, payment_status')
    .eq('guest_id', guest.id)
    .order('check_in', { ascending: false })
    .limit(5)

  const active =
    reservations?.find((r) => r.status === 'checked_in') ??
    reservations?.find((r) => r.status === 'confirmed') ??
    reservations?.[0]

  return {
    guestId: guest.id,
    guestName: guest.name ?? 'Guest',
    guestPhone: guest.phone ?? null,
    guestEmail: guest.email ?? null,
    roomNumber: guest.rooms?.number ?? null,
    roomId: guest.room_id ?? null,
    reservationId: active?.id ?? null,
    checkInDate: active?.check_in ?? guest.check_in ?? null,
    checkOutDate: active?.check_out ?? guest.check_out ?? null,
    reservationStatus: active?.status ?? null,
    paymentStatus: active?.payment_status ?? null,
  }
}
