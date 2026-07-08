import { createAdminClient } from '@/lib/supabase/admin'
import {
  findGuestHousekeepingTask,
  type GuestRequestHousekeepingTask,
} from '@/lib/housekeeping/guest-task'
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

export function extensionAlreadyApplied(
  requestedCheckOut: string,
  reservationCheckOut: string,
): boolean {
  return reservationCheckOut >= requestedCheckOut
}

export function validateExtensionCompletion(
  requestedDate: string | null,
  note: string | null,
  reservation: { check_out: string } | null,
): { ok: true; checkOut: string } | { ok: false; error: string } {
  const requestedCheckOut = requestedDate ?? parseDateFromNote(note)
  if (!requestedCheckOut) {
    return { ok: false, error: 'Set a requested check-out date before completing this extension.' }
  }
  if (!reservation) {
    return { ok: false, error: 'No active reservation found for this guest.' }
  }
  if (!extensionAlreadyApplied(requestedCheckOut, reservation.check_out)) {
    return {
      ok: false,
      error: `Extend the stay to ${requestedCheckOut} in Reservations before marking this request complete.`,
    }
  }
  return { ok: true, checkOut: requestedCheckOut }
}

export function validateHousekeepingCompletion(
  roomId: string | null,
  task: GuestRequestHousekeepingTask | null,
): { ok: true; taskId: string } | { ok: false; error: string } {
  if (!roomId) {
    return { ok: false, error: 'No room linked to this request.' }
  }
  if (!task) {
    return {
      ok: false,
      error: 'Schedule housekeeping on the board before marking this request complete.',
    }
  }
  if (task.status !== 'done') {
    return {
      ok: false,
      error: 'Mark the housekeeping task complete on the board before closing this request.',
    }
  }
  return { ok: true, taskId: task.id }
}

export async function fulfillGuestRequest(
  request: GuestRequestRow,
  status: 'acknowledged' | 'completed' | 'declined',
): Promise<{ detail?: string; error?: string }> {
  if (status !== 'completed') return {}

  const admin = createAdminClient()

  if (request.request_type === 'extension') {
    const { data: reservation } = await admin
      .from('reservations')
      .select('check_out')
      .eq('guest_id', request.guest_id)
      .eq('hotel_id', request.hotel_id)
      .eq('status', 'checked_in')
      .maybeSingle()

    const validation = validateExtensionCompletion(
      request.requested_date,
      request.note,
      reservation,
    )
    if (!validation.ok) return { error: validation.error }
    return { detail: `Your stay is extended until ${validation.checkOut}.` }
  }

  if (request.request_type === 'self_checkout') {
    return {
      detail:
        'Self check-out request received. Please settle any balance at the front desk before leaving.',
    }
  }

  if (request.request_type === 'housekeeping') {
    const task = await findGuestHousekeepingTask(admin, request.hotel_id, request.id)
    const validation = validateHousekeepingCompletion(request.room_id, task)
    if (!validation.ok) return { error: validation.error }
    return { detail: 'Housekeeping for your room is complete.' }
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
