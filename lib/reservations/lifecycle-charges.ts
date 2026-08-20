import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateStayTotal,
  dailyRateForType,
  type RateType,
} from '@/lib/pricing/stay-totals'
import { derivePreCheckoutPaymentStatus } from '@/lib/billing/reservation-payment'
import type { NoShowChargePolicy } from '@/types'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface ChargeableReservation {
  id: string
  hotel_id: string
  guest_id: string | null
  check_in: string
  check_out: string
  room_id: string | null
  nightly_rate?: number | null
  weekly_rate?: number | null
  monthly_rate?: number | null
  rate_type?: string | null
  total_amount?: number | null
  amount_paid?: number | null
}

const NO_SHOW_CHARGE_EVENT = 'no_show_charge_posted'
export const OVERSTAY_CHARGE_EVENT = 'overstay_charge_posted'
export const OVERSTAY_CHARGE_REVERSED_EVENT = 'overstay_charge_reversed'
export const OVERSTAY_FEE_DESCRIPTION = 'Overstay fee (extra night)'

export function isOverstayFeeCharge(charge: { description: string }): boolean {
  return charge.description === OVERSTAY_FEE_DESCRIPTION
}

/** Drop the cron overstay night from a folio list so extended room nights are not billed twice. */
export function folioChargesWithoutOverstayFee<T extends { description: string }>(charges: T[]): T[] {
  return charges.filter((charge) => !isOverstayFeeCharge(charge))
}

export function calculateNoShowChargeAmount(
  reservation: ChargeableReservation,
  policy: NoShowChargePolicy,
  nightlyRate: number,
  monthlyRate: number,
  weeklyRate = 0,
): number {
  if (policy === 'none') return 0

  const rateType = (reservation.rate_type ?? 'nightly') as RateType

  if (policy === 'one_night') {
    return dailyRateForType(rateType, nightlyRate, monthlyRate, weeklyRate)
  }

  const bookedTotal = Number(reservation.total_amount ?? 0)
  if (bookedTotal > 0) return round2(bookedTotal)

  return calculateStayTotal(
    rateType,
    reservation.check_in,
    reservation.check_out,
    nightlyRate,
    monthlyRate,
    weeklyRate,
  )
}

/** Default overstay fee: one additional night at the booked rate. */
export function calculateOverstayChargeAmount(
  reservation: ChargeableReservation,
  nightlyRate: number,
  monthlyRate: number,
  weeklyRate = 0,
): number {
  const rateType = (reservation.rate_type ?? 'nightly') as RateType
  return dailyRateForType(rateType, nightlyRate, monthlyRate, weeklyRate)
}

export async function hasLifecycleChargeEvent(
  admin: SupabaseClient,
  reservationId: string,
  eventType: typeof NO_SHOW_CHARGE_EVENT | typeof OVERSTAY_CHARGE_EVENT,
): Promise<boolean> {
  const { data } = await admin
    .from('reservation_events')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('event_type', eventType)
    .limit(1)

  return (data?.length ?? 0) > 0
}

/** True when the latest overstay charge event is still an unreverted post. */
export async function hasActiveOverstayCharge(
  admin: SupabaseClient,
  reservationId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('reservation_events')
    .select('event_type')
    .eq('reservation_id', reservationId)
    .in('event_type', [OVERSTAY_CHARGE_EVENT, OVERSTAY_CHARGE_REVERSED_EVENT])
    .order('created_at', { ascending: false })
    .limit(1)

  return data?.[0]?.event_type === OVERSTAY_CHARGE_EVENT
}

/**
 * Remove the unbilled overstay night when extra nights are folded into the stay total.
 * Leaves a reversed event so a later overstay can post a fresh fee.
 */
export async function reverseOverstayChargeOnExtend(
  admin: SupabaseClient,
  input: {
    hotelId: string
    reservationId: string
    guestId?: string | null
    actorId?: string | null
  },
): Promise<{ reversed: boolean; amount: number }> {
  let amount = 0

  if (input.guestId) {
    const { data: charges } = await admin
      .from('guest_charges')
      .select('id, amount, description')
      .eq('hotel_id', input.hotelId)
      .eq('guest_id', input.guestId)
      .eq('reservation_id', input.reservationId)
      .eq('description', OVERSTAY_FEE_DESCRIPTION)
      .is('invoice_id', null)

    const toRemove = (charges ?? []).filter(isOverstayFeeCharge)
    amount = round2(toRemove.reduce((sum, row) => sum + Number(row.amount), 0))
    if (toRemove.length) {
      await admin
        .from('guest_charges')
        .delete()
        .in(
          'id',
          toRemove.map((row) => row.id),
        )
    }
  }

  const hadActive = await hasActiveOverstayCharge(admin, input.reservationId)
  if (!hadActive && amount <= 0) {
    return { reversed: false, amount: 0 }
  }

  await admin.from('reservation_events').insert({
    reservation_id: input.reservationId,
    hotel_id: input.hotelId,
    event_type: OVERSTAY_CHARGE_REVERSED_EVENT,
    from_status: 'overstay',
    to_status: 'overstay',
    actor_id: input.actorId ?? null,
    actor_role: input.actorId ? 'staff' : 'system',
    payload: { amount, source: 'stay_extended' },
  })

  return { reversed: true, amount }
}

async function resolveRoomRates(
  admin: SupabaseClient,
  reservation: ChargeableReservation,
): Promise<{ nightlyRate: number; weeklyRate: number; monthlyRate: number }> {
  let nightlyRate = Number(reservation.nightly_rate ?? 0)
  let weeklyRate = Number(reservation.weekly_rate ?? 0)
  let monthlyRate = Number(reservation.monthly_rate ?? 0)

  if (reservation.room_id && nightlyRate <= 0) {
    const { data } = await admin
      .from('rooms')
      .select(
        'nightly_rate, weekly_rate, room_categories(default_nightly_rate, default_weekly_rate, default_monthly_rate)',
      )
      .eq('id', reservation.room_id)
      .maybeSingle()

    if (data?.nightly_rate != null) nightlyRate = Number(data.nightly_rate)
    if (data?.weekly_rate != null && weeklyRate <= 0) weeklyRate = Number(data.weekly_rate)
    const cat = data?.room_categories as {
      default_nightly_rate?: number
      default_weekly_rate?: number
      default_monthly_rate?: number
    } | null
    if (nightlyRate <= 0) nightlyRate = Number(cat?.default_nightly_rate ?? 0)
    if (weeklyRate <= 0) weeklyRate = Number(cat?.default_weekly_rate ?? nightlyRate * 7)
    if (monthlyRate <= 0) monthlyRate = Number(cat?.default_monthly_rate ?? nightlyRate * 30)
  }

  return { nightlyRate, weeklyRate, monthlyRate }
}

export async function applyNoShowCharge(
  admin: SupabaseClient,
  reservation: ChargeableReservation,
  policy: NoShowChargePolicy,
  actorId?: string,
): Promise<{ posted: boolean; amount: number }> {
  if (await hasLifecycleChargeEvent(admin, reservation.id, NO_SHOW_CHARGE_EVENT)) {
    return { posted: false, amount: 0 }
  }

  const { nightlyRate, weeklyRate, monthlyRate } = await resolveRoomRates(admin, reservation)
  const amount = calculateNoShowChargeAmount(
    reservation,
    policy,
    nightlyRate,
    monthlyRate,
    weeklyRate,
  )
  if (amount <= 0) return { posted: false, amount: 0 }

  if (reservation.guest_id) {
    await admin.from('guest_charges').insert({
      hotel_id: reservation.hotel_id,
      guest_id: reservation.guest_id,
      reservation_id: reservation.id,
      description: 'No-show charge',
      amount,
      charge_type: 'room',
      posted_by: actorId ?? null,
    })
  }

  const priorTotal = Number(reservation.total_amount ?? 0)
  const priorPaid = Number(reservation.amount_paid ?? 0)
  const newTotal = round2(Math.max(priorTotal, amount))

  await admin
    .from('reservations')
    .update({
      total_amount: newTotal,
      payment_status: derivePreCheckoutPaymentStatus(newTotal, priorPaid),
    })
    .eq('id', reservation.id)

  await admin.from('reservation_events').insert({
    reservation_id: reservation.id,
    hotel_id: reservation.hotel_id,
    event_type: NO_SHOW_CHARGE_EVENT,
    from_status: 'no_show',
    to_status: 'no_show',
    actor_id: actorId ?? null,
    actor_role: actorId ? 'staff' : 'system',
    payload: { amount, policy },
  })

  return { posted: true, amount }
}

export async function applyOverstayCharge(
  admin: SupabaseClient,
  reservation: ChargeableReservation,
  actorId?: string,
): Promise<{ posted: boolean; amount: number }> {
  if (await hasActiveOverstayCharge(admin, reservation.id)) {
    return { posted: false, amount: 0 }
  }

  if (!reservation.guest_id) return { posted: false, amount: 0 }

  const { nightlyRate, weeklyRate, monthlyRate } = await resolveRoomRates(admin, reservation)
  const amount = calculateOverstayChargeAmount(
    reservation,
    nightlyRate,
    monthlyRate,
    weeklyRate,
  )
  if (amount <= 0) return { posted: false, amount: 0 }

  await admin.from('guest_charges').insert({
    hotel_id: reservation.hotel_id,
    guest_id: reservation.guest_id,
    reservation_id: reservation.id,
    description: OVERSTAY_FEE_DESCRIPTION,
    amount,
    charge_type: 'room',
    posted_by: actorId ?? null,
  })

  await admin.from('reservation_events').insert({
    reservation_id: reservation.id,
    hotel_id: reservation.hotel_id,
    event_type: OVERSTAY_CHARGE_EVENT,
    from_status: 'overstay',
    to_status: 'overstay',
    actor_id: actorId ?? null,
    actor_role: actorId ? 'staff' : 'system',
    payload: { amount },
  })

  return { posted: true, amount }
}
