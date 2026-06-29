import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
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
  monthly_rate?: number | null
  rate_type?: string | null
  total_amount?: number | null
  amount_paid?: number | null
}

const NO_SHOW_CHARGE_EVENT = 'no_show_charge_posted'
const OVERSTAY_CHARGE_EVENT = 'overstay_charge_posted'

export function calculateNoShowChargeAmount(
  reservation: ChargeableReservation,
  policy: NoShowChargePolicy,
  nightlyRate: number,
  monthlyRate: number,
): number {
  if (policy === 'none') return 0

  const rateType = (reservation.rate_type ?? 'nightly') as RateType

  if (policy === 'one_night') {
    if (rateType === 'monthly') return round2(monthlyRate / 30)
    return round2(nightlyRate)
  }

  const bookedTotal = Number(reservation.total_amount ?? 0)
  if (bookedTotal > 0) return round2(bookedTotal)

  return calculateStayTotal(
    rateType,
    reservation.check_in,
    reservation.check_out,
    nightlyRate,
    monthlyRate,
  )
}

/** Default overstay fee: one additional night at the booked rate. */
export function calculateOverstayChargeAmount(
  reservation: ChargeableReservation,
  nightlyRate: number,
  monthlyRate: number,
): number {
  const rateType = (reservation.rate_type ?? 'nightly') as RateType
  if (rateType === 'monthly') return round2(monthlyRate / 30)
  return round2(nightlyRate)
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

async function resolveRoomRates(
  admin: SupabaseClient,
  reservation: ChargeableReservation,
): Promise<{ nightlyRate: number; monthlyRate: number }> {
  let nightlyRate = Number(reservation.nightly_rate ?? 0)
  let monthlyRate = Number(reservation.monthly_rate ?? 0)

  if (reservation.room_id && nightlyRate <= 0) {
    const { data } = await admin
      .from('rooms')
      .select('nightly_rate, room_categories(default_nightly_rate, default_monthly_rate)')
      .eq('id', reservation.room_id)
      .maybeSingle()

    if (data?.nightly_rate != null) nightlyRate = Number(data.nightly_rate)
    const cat = data?.room_categories as {
      default_nightly_rate?: number
      default_monthly_rate?: number
    } | null
    if (nightlyRate <= 0) nightlyRate = Number(cat?.default_nightly_rate ?? 0)
    if (monthlyRate <= 0) monthlyRate = Number(cat?.default_monthly_rate ?? nightlyRate * 30)
  }

  return { nightlyRate, monthlyRate }
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

  const { nightlyRate, monthlyRate } = await resolveRoomRates(admin, reservation)
  const amount = calculateNoShowChargeAmount(reservation, policy, nightlyRate, monthlyRate)
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
  if (await hasLifecycleChargeEvent(admin, reservation.id, OVERSTAY_CHARGE_EVENT)) {
    return { posted: false, amount: 0 }
  }

  if (!reservation.guest_id) return { posted: false, amount: 0 }

  const { nightlyRate, monthlyRate } = await resolveRoomRates(admin, reservation)
  const amount = calculateOverstayChargeAmount(reservation, nightlyRate, monthlyRate)
  if (amount <= 0) return { posted: false, amount: 0 }

  await admin.from('guest_charges').insert({
    hotel_id: reservation.hotel_id,
    guest_id: reservation.guest_id,
    reservation_id: reservation.id,
    description: 'Overstay fee (extra night)',
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
