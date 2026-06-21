import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPhones } from '@/lib/notifications/send'
import { appUrl } from '@/lib/notifications/app-url'
import { notifyManagers } from '@/lib/notifications/manager-notify'

function formatStayDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Guest checked in — send portal link by SMS. */
export async function notifyGuestCheckedIn(input: {
  hotelId: string
  phone: string
  guestName: string
  roomNumber: string | null
  checkOut: string
  loginUrl: string
}): Promise<void> {
  const room = input.roomNumber ? `Room ${input.roomNumber}` : 'Your room'
  const body = [
    `MOJO: Welcome ${input.guestName.trim()}!`,
    `${room} · checkout ${formatStayDate(input.checkOut)}`,
    'Guest portal:',
    input.loginUrl,
  ].join('\n')

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'guest_checked_in',
    includeWhatsApp: false,
  })
}

/** Future reservation confirmed — guest has a linked profile with phone. */
export async function notifyGuestReservationConfirmed(input: {
  hotelId: string
  phone: string
  guestName: string
  roomNumber: string | null
  checkIn: string
  checkOut: string
}): Promise<void> {
  const room = input.roomNumber ? `Room ${input.roomNumber}` : 'Room TBC'
  const body = [
    `MOJO: Booking confirmed for ${input.guestName.trim()}`,
    `${room}`,
    `Check-in ${formatStayDate(input.checkIn)} · checkout ${formatStayDate(input.checkOut)}`,
    appUrl('/guest'),
  ].join('\n')

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'reservation_confirmed',
    includeWhatsApp: false,
  })
}

/** Guest checked out — thank-you and invoice summary. */
export async function notifyGuestCheckedOut(input: {
  hotelId: string
  phone: string
  guestName: string
  totalGhs: number
  paid: boolean
}): Promise<void> {
  const payment = input.paid
    ? `Total GHS ${input.totalGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — paid. Thank you!`
    : `Balance GHS ${input.totalGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due. See front desk.`

  const body = [
    `MOJO: Thank you ${input.guestName.trim()}!`,
    'We hope you enjoyed your stay.',
    payment,
  ].join('\n')

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'guest_checked_out',
    includeWhatsApp: false,
  })
}

export async function loadGuestPhoneForReservation(
  reservationId: string,
): Promise<{ hotelId: string; phone: string; guestName: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('reservations')
    .select('hotel_id, guest_name, guests(phone)')
    .eq('id', reservationId)
    .maybeSingle()

  if (!data) return null
  const guest = data.guests as { phone?: string | null } | null
  const phone = guest?.phone?.trim()
  if (!phone) return null

  return { hotelId: data.hotel_id, phone, guestName: data.guest_name }
}

/** Alert managers when a new reservation is created. */
export async function notifyManagersNewReservation(input: {
  hotelId: string
  guestName: string
  roomNumber: string | null
  checkIn: string
  checkOut: string
  channel: string
}): Promise<void> {
  const room = input.roomNumber ? `Room ${input.roomNumber}` : 'Room TBC'
  const reservationsUrl = appUrl('/manager/reservations')
  const body = [
    'MOJO: New reservation',
    `${input.guestName.trim()} · ${room}`,
    `Check-in ${formatStayDate(input.checkIn)} · checkout ${formatStayDate(input.checkOut)}`,
    `Source: ${input.channel.replace(/_/g, ' ')}`,
    reservationsUrl,
  ].join('\n')

  await notifyManagers({
    hotelId: input.hotelId,
    templateKey: 'reservation_new_manager',
    smsBody: body,
    email: {
      subject: `New booking · ${input.guestName.trim()} · ${room}`,
      preview: 'A new reservation was created for your property.',
      lines: [
        `Guest: ${input.guestName.trim()}`,
        room,
        `Check-in ${formatStayDate(input.checkIn)} · checkout ${formatStayDate(input.checkOut)}`,
        `Source: ${input.channel.replace(/_/g, ' ')}`,
      ],
      actionUrl: reservationsUrl,
      actionLabel: 'View reservations',
    },
  })
}

/** Guest reservation cancelled. */
export async function notifyGuestReservationCancelled(input: {
  hotelId: string
  phone: string
  guestName: string
  checkIn: string
  checkOut: string
}): Promise<void> {
  const body = [
    `MOJO: Booking cancelled for ${input.guestName.trim()}`,
    `Was ${formatStayDate(input.checkIn)} – ${formatStayDate(input.checkOut)}.`,
    'Contact the property if this is unexpected.',
  ].join('\n')

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'reservation_cancelled',
    includeWhatsApp: false,
  })
}
