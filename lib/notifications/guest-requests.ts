import { notifyManagers } from '@/lib/notifications/manager-notify'
import { notifyPhones } from '@/lib/notifications/send'
import { notifyGuestRequestStatusEmail } from '@/lib/notifications/guest-email'
import { appUrl } from '@/lib/notifications/app-url'
import { smsLine, smsRoom, smsTruncate, smsUrl } from '@/lib/notifications/sms-format'

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  late_checkout: 'Late checkout',
  extension: 'Stay extension',
  self_checkout: 'Self check-out',
}

const STATUS_SMS: Record<string, string> = {
  acknowledged: 'Received, we will follow up.',
  completed: 'Approved.',
  declined: 'Not approved — see front desk.',
}

export async function notifyGuestRequestCreated(requestId: string): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin
    .from('guest_requests')
    .select('id, request_type, note, hotel_id, guests(name), rooms(number)')
    .eq('id', requestId)
    .maybeSingle()

  if (!data?.hotel_id) return

  const guestName =
    data.guests && typeof data.guests === 'object' && 'name' in data.guests
      ? String((data.guests as { name: string }).name)
      : 'Guest'
  const roomNumber =
    data.rooms && typeof data.rooms === 'object' && 'number' in data.rooms
      ? String((data.rooms as { number: string }).number)
      : null

  const label = REQUEST_LABELS[data.request_type] ?? 'Guest request'
  const roomPart = roomNumber ? smsRoom(roomNumber) : null
  const notePart = data.note?.trim() ? smsTruncate(data.note.trim(), 50) : null

  await notifyManagers({
    hotelId: data.hotel_id,
    templateKey: 'guest_request',
    smsBody: smsLine(label, 'from', guestName, roomPart, notePart ? `- ${notePart}` : null, smsUrl('/manager/dashboard')),
    email: {
      subject: `${label} — ${guestName}`,
      preview: `${guestName} submitted a ${label.toLowerCase()} request.`,
      lines: [
        `${guestName}${roomNumber ? ` · Room ${roomNumber}` : ''} submitted a ${label.toLowerCase()} request.`,
        ...(data.note?.trim() ? [data.note.trim()] : []),
      ],
      actionUrl: appUrl('/manager/dashboard'),
      actionLabel: 'Open dashboard',
    },
  })
}

export async function notifyGuestRequestStatusChanged(
  requestId: string,
  status: 'acknowledged' | 'completed' | 'declined',
  detail?: string,
): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin
    .from('guest_requests')
    .select('id, request_type, guest_id, hotel_id, guests(name, phone, email)')
    .eq('id', requestId)
    .maybeSingle()

  if (!data?.guest_id || !data.hotel_id) return

  const guest = data.guests as { name?: string; phone?: string | null; email?: string | null } | null
  const label = REQUEST_LABELS[data.request_type] ?? 'Request'
  const statusLine = STATUS_SMS[status] ?? 'Request updated.'
  const detailLine = detail?.trim()

  if (guest?.phone) {
    const body = smsLine(
      'MOJO:',
      `${label}:`,
      statusLine,
      detailLine ? smsTruncate(detailLine, 60) : null,
      smsUrl('/guest'),
    )

    await notifyPhones([guest.phone], body, {
      hotelId: data.hotel_id,
      templateKey: 'guest_request',
      includeWhatsApp: false,
    })
  }

  void notifyGuestRequestStatusEmail(data.guest_id, {
    label,
    status,
    detail: detailLine,
  })
}
