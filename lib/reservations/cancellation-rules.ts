import type { createAdminClient } from '@/lib/supabase/admin'
import { appendReservationEvent } from '@/lib/reservations/state-machine'
import type { Reservation, ReservationActorRole } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

export type HoldSource = 'online' | 'phone' | 'agent'

export interface HotelCancellationDefaults {
  default_free_cancel_days: number
  default_refundable: boolean
  default_penalty_nights: number
}

export interface ReservationHold {
  reservation_id: string
  expires_at: string
  hold_source: HoldSource
  released_at: string | null
}

export function isHoldExpired(hold: ReservationHold, now = new Date()): boolean {
  if (hold.released_at) return false
  return new Date(hold.expires_at).getTime() <= now.getTime()
}

export function getHoldDuration(source: HoldSource, settings: HotelCancellationDefaults & {
  hold_duration_online_minutes?: number
  hold_duration_phone_minutes?: number
  hold_duration_agent_minutes?: number
}): number {
  if (source === 'agent') return settings.hold_duration_agent_minutes ?? 1440
  if (source === 'phone') return settings.hold_duration_phone_minutes ?? 240
  return settings.hold_duration_online_minutes ?? 15
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export interface CancellationRulesInput {
  reservation: {
    id: string
    hotel_id: string
    check_in: string
    amount_paid?: number | null
    total_amount?: number | null
    nightly_rate?: number | null
  }
  hotelSettings: HotelCancellationDefaults
  cancelledAt: Date
  forceMajeure?: boolean
  forceMajeureDocUrl?: string
  hotelInitiated?: boolean
  actorId: string
  actorRole: string
}

export interface CancellationRulesResult {
  canCancel: boolean
  refundAmount: number
  penaltyAmount: number
  policyApplied: string
  requiresManagerApproval: boolean
  reason?: string
}

function cents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(centsValue: number): number {
  return Math.round(centsValue) / 100
}

export async function applyCancellationRules(
  admin: AdminClient,
  input: CancellationRulesInput,
): Promise<CancellationRulesResult> {
  const totalPaidCents = cents(Number(input.reservation.amount_paid ?? 0))
  const roomRateCents = cents(Number(input.reservation.nightly_rate ?? 0))
  const penaltyNights = input.hotelSettings.default_penalty_nights ?? 1
  const freeCancelBefore = addDays(
    input.reservation.check_in,
    input.hotelSettings.default_free_cancel_days ?? 7,
  )
  const cancelledDate = input.cancelledAt.toISOString().slice(0, 10)

  if (input.forceMajeure) {
    if (!input.forceMajeureDocUrl?.trim()) {
      return {
        canCancel: false,
        refundAmount: 0,
        penaltyAmount: 0,
        policyApplied: 'force_majeure',
        requiresManagerApproval: true,
        reason: 'Force majeure cancellation requires documentation URL.',
      }
    }
    return {
      canCancel: true,
      refundAmount: fromCents(totalPaidCents),
      penaltyAmount: 0,
      policyApplied: 'force_majeure',
      requiresManagerApproval: true,
    }
  }

  if (input.hotelInitiated) {
    await appendReservationEvent({
      reservationId: input.reservation.id,
      hotelId: input.reservation.hotel_id,
      eventType: 'compensation_offered',
      actorId: input.actorId,
      actorRole: input.actorRole as ReservationActorRole,
      payload: { initiatedBy: 'hotel' },
    })

    return {
      canCancel: true,
      refundAmount: fromCents(totalPaidCents),
      penaltyAmount: 0,
      policyApplied: 'hotel_initiated',
      requiresManagerApproval: false,
    }
  }

  if (cancelledDate < freeCancelBefore) {
    return {
      canCancel: true,
      refundAmount: fromCents(totalPaidCents),
      penaltyAmount: 0,
      policyApplied: 'free_cancellation_window',
      requiresManagerApproval: false,
    }
  }

  if (!input.hotelSettings.default_refundable) {
    return {
      canCancel: true,
      refundAmount: 0,
      penaltyAmount: fromCents(totalPaidCents),
      policyApplied: 'non_refundable_rate',
      requiresManagerApproval: false,
    }
  }

  const penaltyCents = Math.min(totalPaidCents, roomRateCents * penaltyNights)
  const refundCents = Math.max(0, totalPaidCents - penaltyCents)

  if (penaltyCents > 0 && refundCents > 0) {
    return {
      canCancel: true,
      refundAmount: fromCents(refundCents),
      penaltyAmount: fromCents(penaltyCents),
      policyApplied: 'partial_penalty',
      requiresManagerApproval: false,
    }
  }

  return {
    canCancel: true,
    refundAmount: 0,
    penaltyAmount: fromCents(totalPaidCents),
    policyApplied: 'default_penalty',
    requiresManagerApproval: false,
  }
}

/** Load hotel cancellation defaults for rules engine. */
export async function loadHotelCancellationDefaults(
  admin: AdminClient,
  hotelId: string,
): Promise<HotelCancellationDefaults> {
  const { data } = await admin
    .from('hotels')
    .select('default_free_cancel_days, default_refundable, default_penalty_nights')
    .eq('id', hotelId)
    .maybeSingle()

  return {
    default_free_cancel_days: data?.default_free_cancel_days ?? 7,
    default_refundable: data?.default_refundable ?? true,
    default_penalty_nights: data?.default_penalty_nights ?? 1,
  }
}

// Reservation type used by callers mapping from domain Reservation
export type RatePlan = Pick<
  Reservation,
  'checkInDate' | 'totalPrice' | 'nightlyRate'
>
