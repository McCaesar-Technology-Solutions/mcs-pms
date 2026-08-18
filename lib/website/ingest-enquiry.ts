import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { findAvailableRooms, roomHasClash } from '@/lib/data/occupancy'
import { getRoomRates } from '@/lib/pricing/room-rates'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'
import { transitionReservation } from '@/lib/reservations/state-machine'
import { writeAuditLog } from '@/lib/audit/log'
import { runNotifyTask } from '@/lib/notifications/notify-task'

const enquiryIngestSchema = z.object({
  enquiryId: z.string().uuid(),
  propertyId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(20),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export type WebsiteEnquiryIngestInput = z.infer<typeof enquiryIngestSchema>

export type WebsiteEnquiryIngestResult =
  | {
      ok: true
      reservationId: string
      hotelId: string
      roomId: string
      status: 'provisional' | 'confirmed'
      reused: boolean
    }
  | { ok: false; error: string; code: string }

type Admin = SupabaseClient

export function parseWebsiteEnquiryIngest(input: unknown) {
  return enquiryIngestSchema.safeParse(input)
}

export async function ingestWebsiteEnquiry(
  admin: Admin,
  raw: unknown,
): Promise<WebsiteEnquiryIngestResult> {
  const parsed = enquiryIngestSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid enquiry.',
      code: 'INVALID',
    }
  }
  const input = parsed.data
  if (input.checkOut <= input.checkIn) {
    return { ok: false, error: 'Check-out must be after check-in.', code: 'INVALID_DATES' }
  }

  const { data: existing } = await admin
    .from('reservations')
    .select('id, hotel_id, room_id, status')
    .eq('website_enquiry_id', input.enquiryId)
    .maybeSingle()

  if (existing) {
    return {
      ok: true,
      reservationId: existing.id,
      hotelId: existing.hotel_id,
      roomId: existing.room_id ?? '',
      status: existing.status === 'confirmed' ? 'confirmed' : 'provisional',
      reused: true,
    }
  }

  const { data: map } = await admin
    .from('website_listing_maps')
    .select('hotel_id, room_id, is_active, website_slug')
    .eq('website_property_id', input.propertyId)
    .maybeSingle()

  if (!map || !map.is_active) {
    return {
      ok: false,
      error: 'This listing is not linked to a PMS property.',
      code: 'UNMAPPED',
    }
  }

  const roomId = await resolveRoomForEnquiry(admin, map.hotel_id, map.room_id, input.checkIn, input.checkOut)
  if (!roomId.ok) return roomId

  const guestId = await findOrCreateWebsiteGuest(admin, {
    hotelId: map.hotel_id,
    name: input.fullName,
    email: input.email,
    phone: input.phone,
  })
  if (!guestId.ok) return guestId

  const rates = await getRoomRates(admin, roomId.roomId)
  const total = calculateStayTotal(
    'nightly',
    input.checkIn,
    input.checkOut,
    rates.nightlyRate,
    rates.monthlyRate,
    rates.weeklyRate,
  )

  const { data: row, error } = await admin
    .from('reservations')
    .insert({
      hotel_id: map.hotel_id,
      room_id: roomId.roomId,
      guest_id: guestId.guestId,
      guest_name: input.fullName,
      check_in: input.checkIn,
      check_out: input.checkOut,
      status: 'inquiry',
      channel: 'direct',
      rate_type: 'nightly',
      nightly_rate: rates.nightlyRate,
      weekly_rate: rates.weeklyRate,
      monthly_rate: rates.monthlyRate,
      total_amount: total,
      payment_status: 'unpaid',
      amount_paid: 0,
      deposit_amount: 0,
      website_enquiry_id: input.enquiryId,
      created_by: null,
    })
    .select('id')
    .single()

  if (error || !row) {
    if (error?.code === '23505') {
      const { data: raced } = await admin
        .from('reservations')
        .select('id, hotel_id, room_id, status')
        .eq('website_enquiry_id', input.enquiryId)
        .maybeSingle()
      if (raced) {
        return {
          ok: true,
          reservationId: raced.id,
          hotelId: raced.hotel_id,
          roomId: raced.room_id ?? roomId.roomId,
          status: raced.status === 'confirmed' ? 'confirmed' : 'provisional',
          reused: true,
        }
      }
    }
    if (error?.code === '23P01' || /overlap|exclusion|clash/i.test(error?.message ?? '')) {
      return { ok: false, error: 'Those dates are no longer available.', code: 'ROOM_UNAVAILABLE' }
    }
    return { ok: false, error: error?.message ?? 'Could not create reservation.', code: 'INSERT_FAILED' }
  }

  const held = await transitionReservation({
    reservationId: row.id,
    hotelId: map.hotel_id,
    toStatus: 'provisional',
    actorRole: 'system',
    bypassRoleCheck: true,
    payload: {
      source: 'website_enquiry',
      enquiryId: input.enquiryId,
      guests: input.guests,
      notes: input.notes ?? null,
      email: input.email,
    },
  })

  if (!held.success) {
    await admin.from('reservations').delete().eq('id', row.id)
    if (held.code === 'ROOM_CONFLICT') {
      return { ok: false, error: 'Those dates are no longer available.', code: 'ROOM_UNAVAILABLE' }
    }
    return { ok: false, error: held.error ?? 'Could not hold the room.', code: 'TRANSITION_FAILED' }
  }

  const { data: room } = await admin.from('rooms').select('number').eq('id', roomId.roomId).maybeSingle()

  void writeAuditLog({
    hotelId: map.hotel_id,
    actorId: null,
    actorName: 'Website',
    entityType: 'reservation',
    entityId: row.id,
    action: 'website_enquiry',
    summary: `Website request: ${input.fullName}${room?.number ? ` — Room ${room.number}` : ''} (${input.checkIn} → ${input.checkOut})`,
    details: { enquiryId: input.enquiryId, propertyId: input.propertyId },
  })

  void import('@/lib/notifications/stays').then(({ notifyManagersNewReservation }) => {
    runNotifyTask(
      notifyManagersNewReservation({
        hotelId: map.hotel_id,
        guestName: input.fullName,
        roomNumber: room?.number ?? null,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        channel: 'website',
      }),
      { templateKey: 'reservation_new_manager', hotelId: map.hotel_id },
    )
  })

  return {
    ok: true,
    reservationId: row.id,
    hotelId: map.hotel_id,
    roomId: roomId.roomId,
    status: 'provisional',
    reused: false,
  }
}

export async function confirmWebsiteEnquiry(
  admin: Admin,
  enquiryId: string,
): Promise<WebsiteEnquiryIngestResult> {
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, room_id, status')
    .eq('website_enquiry_id', enquiryId)
    .maybeSingle()

  if (!reservation) {
    return { ok: false, error: 'No PMS reservation for this enquiry.', code: 'NOT_FOUND' }
  }

  if (reservation.status === 'confirmed' || reservation.status === 'pre_arrival') {
    return {
      ok: true,
      reservationId: reservation.id,
      hotelId: reservation.hotel_id,
      roomId: reservation.room_id ?? '',
      status: 'confirmed',
      reused: true,
    }
  }

  if (reservation.status !== 'provisional' && reservation.status !== 'inquiry') {
    return {
      ok: false,
      error: `Cannot confirm a stay that is ${reservation.status}.`,
      code: 'INVALID_STATUS',
    }
  }

  if (reservation.status === 'inquiry') {
    const held = await transitionReservation({
      reservationId: reservation.id,
      hotelId: reservation.hotel_id,
      toStatus: 'provisional',
      actorRole: 'system',
      bypassRoleCheck: true,
      payload: { source: 'website_approve' },
    })
    if (!held.success) {
      return { ok: false, error: held.error ?? 'Could not hold the room.', code: 'TRANSITION_FAILED' }
    }
  }

  const confirmed = await transitionReservation({
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    toStatus: 'confirmed',
    actorRole: 'system',
    bypassRoleCheck: true,
    eventType: 'direct_confirmed',
    payload: { source: 'website_approve' },
  })

  if (!confirmed.success) {
    return { ok: false, error: confirmed.error ?? 'Could not confirm reservation.', code: 'TRANSITION_FAILED' }
  }

  void writeAuditLog({
    hotelId: reservation.hotel_id,
    actorId: null,
    actorName: 'Website',
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'website_confirmed',
    summary: `Website enquiry approved → confirmed stay`,
    details: { enquiryId },
  })

  return {
    ok: true,
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    roomId: reservation.room_id ?? '',
    status: 'confirmed',
    reused: false,
  }
}

export async function declineWebsiteEnquiry(
  admin: Admin,
  enquiryId: string,
): Promise<WebsiteEnquiryIngestResult> {
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, room_id, status')
    .eq('website_enquiry_id', enquiryId)
    .maybeSingle()

  if (!reservation) {
    return { ok: false, error: 'No PMS reservation for this enquiry.', code: 'NOT_FOUND' }
  }

  if (
    reservation.status === 'cancelled' ||
    reservation.status === 'released' ||
    reservation.status === 'no_show'
  ) {
    return {
      ok: true,
      reservationId: reservation.id,
      hotelId: reservation.hotel_id,
      roomId: reservation.room_id ?? '',
      status: 'provisional',
      reused: true,
    }
  }

  if (reservation.status !== 'provisional' && reservation.status !== 'inquiry') {
    return {
      ok: false,
      error: `Cannot decline a stay that is ${reservation.status}. Handle it on the front desk.`,
      code: 'INVALID_STATUS',
    }
  }

  const cancelled = await transitionReservation({
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    toStatus: 'cancelled',
    actorRole: 'system',
    bypassRoleCheck: true,
    payload: { source: 'website_decline' },
  })

  if (!cancelled.success) {
    return { ok: false, error: cancelled.error ?? 'Could not release the hold.', code: 'TRANSITION_FAILED' }
  }

  void writeAuditLog({
    hotelId: reservation.hotel_id,
    actorId: null,
    actorName: 'Website',
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'website_declined',
    summary: 'Website enquiry declined — hold released',
    details: { enquiryId },
  })

  return {
    ok: true,
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    roomId: reservation.room_id ?? '',
    status: 'provisional',
    reused: false,
  }
}

async function resolveRoomForEnquiry(
  admin: Admin,
  hotelId: string,
  mappedRoomId: string | null,
  checkIn: string,
  checkOut: string,
): Promise<{ ok: true; roomId: string } | { ok: false; error: string; code: string }> {
  if (mappedRoomId) {
    const clash = await roomHasClash(admin, hotelId, mappedRoomId, checkIn, checkOut)
    if (clash) {
      return { ok: false, error: 'The mapped room is not available for those dates.', code: 'ROOM_UNAVAILABLE' }
    }
    return { ok: true, roomId: mappedRoomId }
  }

  const available = await findAvailableRooms(admin, hotelId, checkIn, checkOut)
  const first = available[0]
  if (!first) {
    return { ok: false, error: 'No rooms available for those dates.', code: 'ROOM_UNAVAILABLE' }
  }
  return { ok: true, roomId: first.id }
}

async function findOrCreateWebsiteGuest(
  admin: Admin,
  input: { hotelId: string; name: string; email: string; phone: string },
): Promise<{ ok: true; guestId: string } | { ok: false; error: string; code: string }> {
  const phone = input.phone.trim()
  const { data: byPhone } = await admin
    .from('guests')
    .select('id')
    .eq('hotel_id', input.hotelId)
    .eq('phone', phone)
    .maybeSingle()

  if (byPhone?.id) {
    await admin
      .from('guests')
      .update({ name: input.name, email: input.email })
      .eq('id', byPhone.id)
    return { ok: true, guestId: byPhone.id }
  }

  const { data: created, error } = await admin
    .from('guests')
    .insert({
      hotel_id: input.hotelId,
      name: input.name,
      email: input.email,
      phone,
    })
    .select('id')
    .single()

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Could not save guest.', code: 'GUEST_FAILED' }
  }
  return { ok: true, guestId: created.id }
}
