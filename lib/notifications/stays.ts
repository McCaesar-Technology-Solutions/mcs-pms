import { notifyPhones } from '@/lib/notifications/send'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { appUrl } from '@/lib/notifications/app-url'
import { smsLine, smsRoom, smsShortDate, smsGuestEnterUrl, smsUrl } from '@/lib/notifications/sms-format'
import { notifyManagers } from '@/lib/notifications/manager-notify'

/** Guest checked in — send portal link by SMS. */
export async function notifyGuestCheckedIn(input: {
  hotelId: string
  phone: string
  guestName: string
  roomNumber: string | null
  checkOut: string
  portalToken: string
}): Promise<void> {
  const body = smsLine(
    'MOJO:',
    `Welcome ${input.guestName.trim()}!`,
    smsRoom(input.roomNumber),
    `out ${smsShortDate(input.checkOut)}.`,
    smsGuestEnterUrl(input.portalToken),
  )

  await notifyPhones([input.phone], body, phoneNotifyOpts('guest_checked_in', { hotelId: input.hotelId }))
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
  const body = smsLine(
    'MOJO:',
    `Booking confirmed ${input.guestName.trim()},`,
    smsRoom(input.roomNumber),
    `in ${smsShortDate(input.checkIn)} out ${smsShortDate(input.checkOut)}.`,
    smsUrl('/guest'),
  )

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
  const amount = input.totalGhs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const payment = input.paid ? `GHS ${amount} paid. Thanks!` : `GHS ${amount} due at desk.`

  const body = smsLine(
    'MOJO:',
    `Thanks ${input.guestName.trim()}!`,
    payment,
  )

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'guest_checked_out',
    includeWhatsApp: false,
  })
}

export async function loadGuestPhoneForReservation(
  reservationId: string,
): Promise<{ hotelId: string; phone: string; guestName: string } | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
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
  const reservationsUrl = smsUrl('/manager/reservations')
  const body = smsLine(
    'MOJO:',
    `New booking ${input.guestName.trim()},`,
    smsRoom(input.roomNumber),
    `in ${smsShortDate(input.checkIn)} out ${smsShortDate(input.checkOut)}`,
    `(${input.channel.replace(/_/g, ' ')}).`,
    reservationsUrl,
  )

  await notifyManagers({
    hotelId: input.hotelId,
    templateKey: 'reservation_new_manager',
    smsBody: body,
    email: {
      subject: `New booking · ${input.guestName.trim()} · ${smsRoom(input.roomNumber)}`,
      preview: 'A new reservation was created for your property.',
      lines: [
        `Guest: ${input.guestName.trim()}`,
        smsRoom(input.roomNumber),
        `Check-in ${smsShortDate(input.checkIn)} · checkout ${smsShortDate(input.checkOut)}`,
        `Source: ${input.channel.replace(/_/g, ' ')}`,
      ],
      actionUrl: appUrl('/manager/reservations'),
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
  const body = smsLine(
    'MOJO:',
    `Booking cancelled ${input.guestName.trim()},`,
    `was ${smsShortDate(input.checkIn)}-${smsShortDate(input.checkOut)}.`,
  )

  await notifyPhones([input.phone], body, {
    hotelId: input.hotelId,
    templateKey: 'reservation_cancelled',
    includeWhatsApp: false,
  })
}
