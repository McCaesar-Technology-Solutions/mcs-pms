import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod } from '@/types'
import {
  derivePreCheckoutPaymentStatus,
  reservationBalanceDue,
} from '@/lib/billing/reservation-payment'
import type { Database } from '@/lib/supabase/types'

type AdminClient = SupabaseClient<Database>

export async function applyOnlineReservationDeposit(
  admin: AdminClient,
  input: {
    hotelId: string
    reservationId: string
    amount: number
    paymentMethod: PaymentMethod
    providerReference: string
    actorId?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, guest_id, guest_name, status, total_amount, amount_paid')
    .eq('id', input.reservationId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!reservation) return { ok: false, error: 'Reservation not found' }
  if (
    reservation.status !== 'confirmed' &&
    reservation.status !== 'checked_in' &&
    reservation.status !== 'provisional'
  ) {
    return { ok: false, error: 'Deposits can only apply before check-out' }
  }

  const total = Number(reservation.total_amount ?? 0)
  const currentPaid = Number(reservation.amount_paid ?? 0)
  const balance = reservationBalanceDue(total, currentPaid)
  const payAmount = Math.min(input.amount, balance)
  if (payAmount <= 0) return { ok: true }

  const now = new Date().toISOString()
  const idempotencyKey = `paystack:deposit:${input.providerReference}`

  const { data: existingPayment } = await admin
    .from('payment_records')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingPayment?.status === 'success') {
    return { ok: true }
  }

  if (!existingPayment) {
    await admin.from('payment_records').insert({
      hotel_id: input.hotelId,
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      provider: 'paystack',
      provider_reference: input.providerReference,
      amount: payAmount,
      currency: 'GHS',
      status: 'success',
      idempotency_key: idempotencyKey,
      completed_at: now,
      metadata: { type: 'deposit' },
    })
  }

  const newPaid = Math.round((currentPaid + payAmount) * 100) / 100
  await admin
    .from('reservations')
    .update({
      amount_paid: newPaid,
      payment_method: input.paymentMethod,
      payment_status: derivePreCheckoutPaymentStatus(total, newPaid),
    })
    .eq('id', reservation.id)

  if (reservation.status === 'provisional') {
    const { transitionReservation } = await import('@/lib/reservations/state-machine')
    const confirmed = await transitionReservation({
      reservationId: reservation.id,
      hotelId: input.hotelId,
      toStatus: 'confirmed',
      actorId: input.actorId ?? undefined,
      // Webhook has no staff session; system role is allowed for staff-required transitions.
      actorRole: 'system',
      bypassRoleCheck: true,
      payload: { depositAmount: payAmount, online: true },
    })
    if (!confirmed.success) {
      return { ok: false, error: confirmed.error ?? 'Could not confirm reservation after deposit.' }
    }
  }

  return { ok: true }
}
