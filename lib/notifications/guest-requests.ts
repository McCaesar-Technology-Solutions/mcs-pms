import { createAdminClient } from '@/lib/supabase/admin'
import { notifyManagers } from '@/lib/notifications/manager-notify'
import { appUrl } from '@/lib/notifications/app-url'

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  late_checkout: 'Late checkout',
  extension: 'Stay extension',
  self_checkout: 'Self check-out',
}

export async function notifyGuestRequestCreated(requestId: string): Promise<void> {
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
  const roomPart = roomNumber ? ` · Room ${roomNumber}` : ''
  const notePart = data.note?.trim() ? ` — ${data.note.trim()}` : ''

  await notifyManagers({
    hotelId: data.hotel_id,
    templateKey: 'guest_request',
    smsBody: `${label} from ${guestName}${roomPart}${notePart}. Open the dashboard to respond.`,
    email: {
      subject: `${label} — ${guestName}`,
      preview: `${guestName} submitted a ${label.toLowerCase()} request.`,
      lines: [
        `${guestName}${roomPart} submitted a ${label.toLowerCase()} request.`,
        ...(data.note?.trim() ? [data.note.trim()] : []),
      ],
      actionUrl: appUrl('/manager/dashboard'),
      actionLabel: 'Open dashboard',
    },
  })
}
