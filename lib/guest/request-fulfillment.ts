import { createAdminClient } from '@/lib/supabase/admin'
import { extendStay } from '@/app/actions/stays'
import { createGuestHousekeepingTask } from '@/lib/housekeeping/guest-task'
import { notifyGuestRequestStatusChanged } from '@/lib/notifications/guest-requests'

interface GuestRequestRow {
  id: string
  hotel_id: string
  guest_id: string
  room_id: string | null
  request_type: string
  note: string | null
  requested_date: string | null
  requested_time: string | null
}

export async function fulfillGuestRequest(
  request: GuestRequestRow,
  status: 'acknowledged' | 'completed' | 'declined',
): Promise<{ detail?: string; error?: string }> {
  if (status !== 'completed') return {}

  const admin = createAdminClient()

  if (request.request_type === 'extension') {
    const newCheckOut = request.requested_date ?? parseDateFromNote(request.note)
    if (!newCheckOut) {
      return { error: 'Set a requested check-out date before completing this extension.' }
    }

    const { data: reservation } = await admin
      .from('reservations')
      .select('id')
      .eq('guest_id', request.guest_id)
      .eq('hotel_id', request.hotel_id)
      .eq('status', 'checked_in')
      .maybeSingle()

    if (!reservation) {
      return { error: 'No active reservation found for this guest.' }
    }

    const result = await extendStay(reservation.id, newCheckOut)
    if (!result.success) {
      return { error: result.error ?? 'Could not extend stay.' }
    }
    return { detail: `Your stay is extended until ${newCheckOut}.` }
  }

  if (request.request_type === 'self_checkout') {
    return {
      detail:
        'Self check-out request received. Please settle any balance at the front desk before leaving.',
    }
  }

  if (request.request_type === 'housekeeping') {
    if (!request.room_id) {
      return { error: 'No room linked to this request.' }
    }

    const result = await createGuestHousekeepingTask(admin, {
      hotelId: request.hotel_id,
      roomId: request.room_id,
      guestId: request.guest_id,
      note: request.note,
      guestRequestId: request.id,
    })

    if (!result.created && !result.taskId) {
      return { error: 'Could not create housekeeping task.' }
    }
    return { detail: 'Housekeeping has been scheduled for your room.' }
  }

  if (request.request_type === 'late_checkout') {
    const time = request.requested_time ?? request.note?.trim()
    return {
      detail: time
        ? `Late checkout noted for ${time}. Please confirm at the front desk if needed.`
        : 'Late checkout request received. The front desk will confirm your time.',
    }
  }

  return {}
}

function parseDateFromNote(note: string | null): string | null {
  if (!note) return null
  const match = note.match(/\d{4}-\d{2}-\d{2}/)
  return match?.[0] ?? null
}

export async function notifyRequestStatus(
  requestId: string,
  status: 'acknowledged' | 'completed' | 'declined',
  detail?: string,
): Promise<void> {
  await notifyGuestRequestStatusChanged(requestId, status, detail)
}
