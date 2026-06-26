import type { createAdminClient } from '@/lib/supabase/admin'
import { loadUnbilledFolioCharges, sumFolioSubtotal } from '@/lib/folio/rollup'
import {
  canCancelReservationStatus,
  isVoidedReservationStatus,
} from '@/lib/reservations/lifecycle'

type AdminClient = ReturnType<typeof createAdminClient>

export async function validateReservationCancellation(
  admin: AdminClient,
  reservation: {
    id: string
    status: string | null
    guest_id: string | null
    hotel_id: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = reservation.status

  if (isVoidedReservationStatus(status)) {
    return { ok: false, error: 'This reservation is already cancelled or marked no-show.' }
  }

  if (status === 'checked_in') {
    return {
      ok: false,
      error: 'Guest is in-house. Use Check out to settle the bill and release the room.',
    }
  }

  if (status === 'checked_out') {
    return { ok: false, error: 'Completed stays cannot be cancelled.' }
  }

  if (!canCancelReservationStatus(status)) {
    return { ok: false, error: 'This reservation cannot be cancelled.' }
  }

  if (reservation.guest_id) {
    const charges = await loadUnbilledFolioCharges(
      admin,
      reservation.hotel_id,
      reservation.guest_id,
      reservation.id,
    )
    const folioSubtotal = sumFolioSubtotal(charges)
    if (folioSubtotal > 0) {
      return {
        ok: false,
        error: `Outstanding folio balance of ₵${folioSubtotal.toLocaleString()}. Settle or remove charges before cancelling.`,
      }
    }
  }

  const { data: invoice } = await admin
    .from('invoices')
    .select('payment_status, total_amount, amount_paid')
    .eq('reservation_id', reservation.id)
    .maybeSingle()

  if (invoice) {
    const total = Number(invoice.total_amount ?? 0)
    const paid = Number(invoice.amount_paid ?? 0)
    const due = Math.round((total - paid) * 100) / 100
    if (invoice.payment_status !== 'paid' && due > 0) {
      return {
        ok: false,
        error: `Unpaid invoice balance of ₵${due.toLocaleString()}. Record payment or adjust billing before cancelling.`,
      }
    }
  }

  return { ok: true }
}
