import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types'
import { writeAuditLog } from '@/lib/audit/log'

export type DepositDisposition = 'forfeit' | 'refund'

export function requiresDepositDisposition(amountPaid: number): boolean {
  return amountPaid > 0.009
}

export function validateDepositDispositionInput(
  amountPaid: number,
  disposition: DepositDisposition | undefined,
  role: UserRole | string,
): { ok: true } | { ok: false; error: string } {
  if (!requiresDepositDisposition(amountPaid)) return { ok: true }

  if (!disposition) {
    return {
      ok: false,
      error: `₵${amountPaid.toLocaleString()} deposit collected. Choose forfeit (hotel keeps) or refund before continuing.`,
    }
  }

  if (disposition === 'refund' && role !== 'owner') {
    return { ok: false, error: 'Only the property owner can refund deposits.' }
  }

  return { ok: true }
}

export async function applyDepositDisposition(
  admin: SupabaseClient,
  input: {
    hotelId: string
    reservationId: string
    guestId: string | null
    guestName: string
    amountPaid: number
    disposition: DepositDisposition
    reason: 'cancelled' | 'no_show'
    actorId: string
    actorName: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const amount = Math.round(input.amountPaid * 100) / 100
  if (!requiresDepositDisposition(amount)) return { ok: true }

  const now = new Date().toISOString()

  if (input.disposition === 'refund') {
    const idempotencyKey = `deposit-refund:${input.reservationId}:${input.reason}`

    const { data: existing } = await admin
      .from('payment_records')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (!existing) {
      const { error: recordError } = await admin.from('payment_records').insert({
        hotel_id: input.hotelId,
        reservation_id: input.reservationId,
        guest_id: input.guestId,
        provider: 'manual',
        provider_reference: `Deposit refund (${input.reason.replace(/_/g, ' ')})`,
        amount,
        currency: 'GHS',
        status: 'refunded',
        idempotency_key: idempotencyKey,
        completed_at: now,
        metadata: { type: 'deposit_refund', reason: input.reason },
      })

      if (recordError) return { ok: false, error: recordError.message }
    }

    void writeAuditLog({
      hotelId: input.hotelId,
      actorId: input.actorId,
      actorName: input.actorName,
      entityType: 'reservation',
      entityId: input.reservationId,
      action: 'deposit_refund',
      summary: `Refunded ₵${amount} deposit on ${input.guestName} (${input.reason.replace(/_/g, ' ')})`,
    })

    const { error } = await admin
      .from('reservations')
      .update({ amount_paid: 0, payment_status: 'unpaid', payment_method: null })
      .eq('id', input.reservationId)

    if (error) return { ok: false, error: error.message }
  } else {
    void writeAuditLog({
      hotelId: input.hotelId,
      actorId: input.actorId,
      actorName: input.actorName,
      entityType: 'reservation',
      entityId: input.reservationId,
      action: 'deposit_forfeit',
      summary: `Forfeited ₵${amount} deposit on ${input.guestName} (${input.reason.replace(/_/g, ' ')})`,
    })
  }

  return { ok: true }
}
