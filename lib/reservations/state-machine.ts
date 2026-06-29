import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/log'
import { asReservationStatus } from '@/lib/reservations/lifecycle'
import { runSideEffects, type ReservationRow } from '@/lib/reservations/side-effects'
import {
  actorMeetsRequiredRole,
  getTransitionDef,
  normalizeActorRole,
} from '@/lib/reservations/transitions'
import type { ReservationActorRole, ReservationStatus } from '@/types'

export interface TransitionReservationInput {
  reservationId: string
  hotelId: string
  toStatus: ReservationStatus
  actorId?: string
  actorRole?: ReservationActorRole
  payload?: Record<string, unknown>
  bypassRoleCheck?: boolean
  /** Override event type (e.g. hold_cancelled vs cancellation_applied). */
  eventType?: string
  /** Skip room status update when handled externally (e.g. move room). */
  skipRoomStatus?: boolean
}

export interface TransitionReservationResult {
  success: boolean
  eventId?: string
  error?: string
  code?: string
  fromStatus?: ReservationStatus
}

async function loadReservation(
  admin: ReturnType<typeof createAdminClient>,
  reservationId: string,
  hotelId: string,
): Promise<ReservationRow | null> {
  const { data } = await admin
    .from('reservations')
    .select(
      'id, hotel_id, room_id, guest_id, guest_name, status, check_in, check_out, channel, amount_paid, total_amount',
    )
    .eq('id', reservationId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  return data as ReservationRow | null
}

async function validatePreTransition(
  admin: ReturnType<typeof createAdminClient>,
  reservation: ReservationRow,
  toStatus: ReservationStatus,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  if (toStatus === 'checked_in' && !reservation.room_id) {
    return { ok: false, error: 'Reservation has no room assigned.', code: 'NO_ROOM' }
  }

  if (toStatus === 'checked_in' && reservation.guest_id) {
    const { loadUnbilledFolioCharges, sumFolioSubtotal } = await import('@/lib/folio/rollup')
    const charges = await loadUnbilledFolioCharges(
      admin,
      reservation.hotel_id,
      reservation.guest_id,
      reservation.id,
    )
    const folioSubtotal = sumFolioSubtotal(charges)
    if (folioSubtotal > 0 && reservation.status === 'confirmed') {
      // Allow check-in with open folio from prior stays — only block impossible states
      void folioSubtotal
    }
  }

  return { ok: true }
}

export async function transitionReservation(
  input: TransitionReservationInput,
): Promise<TransitionReservationResult> {
  const admin = createAdminClient()
  const reservation = await loadReservation(admin, input.reservationId, input.hotelId)

  if (!reservation) {
    return { success: false, error: 'Reservation not found.', code: 'NOT_FOUND' }
  }

  const fromStatus = asReservationStatus(reservation.status)
  if (!fromStatus) {
    return { success: false, error: 'Unknown reservation status.', code: 'INVALID_STATUS' }
  }

  if (fromStatus === input.toStatus) {
    return { success: true, fromStatus }
  }

  const def = getTransitionDef(fromStatus, input.toStatus)
  if (!def) {
    return {
      success: false,
      error: `Cannot transition from ${fromStatus} to ${input.toStatus}.`,
      code: 'INVALID_TRANSITION',
    }
  }

  const actorRole = normalizeActorRole(input.actorRole)
  if (
    !actorMeetsRequiredRole(actorRole, def.requiredRole, input.bypassRoleCheck) &&
    !(def.requiredRole === 'system' && input.bypassRoleCheck)
  ) {
    return { success: false, error: 'Not authorized for this transition.', code: 'INSUFFICIENT_ROLE' }
  }

  const pre = await validatePreTransition(admin, reservation, input.toStatus)
  if (!pre.ok) {
    return { success: false, error: pre.error, code: pre.code }
  }

  const eventType = input.eventType ?? def.eventType
  const sideCtx = {
    admin,
    reservation,
    fromStatus,
    toStatus: input.toStatus,
    eventType,
    payload: input.payload,
    actorId: input.actorId,
    actorRole: input.actorRole,
  }

  const { holdSource, holdMinutes, roomStatus } = await runSideEffects(def.sideEffects, sideCtx)

  const { data: rpcResult, error: rpcError } = await admin.rpc('transition_reservation_status', {
    p_reservation_id: input.reservationId,
    p_hotel_id: input.hotelId,
    p_to_status: input.toStatus,
    p_event_type: eventType,
    p_actor_id: input.actorId ?? null,
    p_actor_role: input.actorRole ?? null,
    p_payload: (input.payload ?? {}) as import('@/lib/supabase/types').Json,
    p_room_status: input.skipRoomStatus ? null : roomStatus,
    p_room_updated_by: input.actorId ?? null,
    p_hold_source: holdSource ?? null,
    p_hold_minutes: holdMinutes ?? null,
    p_expected_from: fromStatus,
  })

  if (rpcError) {
    return { success: false, error: rpcError.message, code: 'RPC_ERROR' }
  }

  const result = rpcResult as {
    success?: boolean
    event_id?: string
    error?: string
    code?: string
    idempotent?: boolean
    from_status?: string
  } | null

  if (!result?.success) {
    return {
      success: false,
      error: result?.error ?? 'Transition failed.',
      code: result?.code ?? 'TRANSITION_FAILED',
      fromStatus: asReservationStatus(result?.from_status) ?? undefined,
    }
  }

  if (input.actorId) {
    void writeAuditLog({
      hotelId: input.hotelId,
      actorId: input.actorId,
      entityType: 'reservation',
      entityId: input.reservationId,
      action: eventType,
      summary: `${reservation.guest_name}: ${fromStatus} → ${input.toStatus}`,
      details: input.payload ?? null,
    })
  }

  return {
    success: true,
    eventId: result.event_id,
    fromStatus,
  }
}

export async function appendReservationEvent(input: {
  reservationId: string
  hotelId: string
  eventType: string
  actorId?: string
  actorRole?: ReservationActorRole
  payload?: Record<string, unknown>
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('status')
    .eq('id', input.reservationId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!reservation) {
    return { success: false, error: 'Reservation not found.' }
  }

  const { data, error } = await admin
    .from('reservation_events')
    .insert({
      reservation_id: input.reservationId,
      hotel_id: input.hotelId,
      event_type: input.eventType,
      from_status: reservation.status,
      to_status: reservation.status,
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole ?? null,
      payload: (input.payload ?? {}) as import('@/lib/supabase/types').Json,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Could not log event.' }
  }

  return { success: true, eventId: data.id }
}
