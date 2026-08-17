import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod } from '@/types'
import { applyStayPayment } from '@/lib/billing/apply-stay-payment'
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
    .select('id, status')
    .eq('id', input.reservationId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!reservation) return { ok: false, error: 'Reservation not found' }

  const idempotencyKey = `paystack:deposit:${input.providerReference}`
  const result = await applyStayPayment(admin, {
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    provider: 'paystack',
    providerReference: input.providerReference,
    idempotencyKey,
    metadata: { type: 'deposit' },
    phase: 'pre_arrival',
  })

  if (!result.ok) return result

  if (reservation.status === 'provisional') {
    const { transitionReservation } = await import('@/lib/reservations/state-machine')
    const confirmed = await transitionReservation({
      reservationId: input.reservationId,
      hotelId: input.hotelId,
      toStatus: 'confirmed',
      actorId: input.actorId ?? undefined,
      actorRole: 'system',
      bypassRoleCheck: true,
      payload: { depositAmount: result.amountApplied, online: true },
    })
    if (!confirmed.success) {
      return { ok: false, error: confirmed.error ?? 'Could not confirm reservation after deposit.' }
    }
  }

  return { ok: true }
}
