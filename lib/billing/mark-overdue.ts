import type { SupabaseClient } from '@supabase/supabase-js'
import { syncReservationPaymentFromInvoice } from '@/lib/billing/reservation-payment'
import { todayISO } from '@/lib/stays/helpers'

/** Invoice statuses that can transition to overdue when past due date. */
const OVERDUE_ELIGIBLE = ['pending', 'partial'] as const

export function isInvoicePastDue(
  dueAt: string | null | undefined,
  today: string = todayISO(),
): boolean {
  if (!dueAt) return false
  return dueAt.slice(0, 10) < today
}

export function shouldMarkInvoiceOverdue(
  paymentStatus: string | null | undefined,
  dueAt: string | null | undefined,
  today: string = todayISO(),
): boolean {
  if (!paymentStatus || !OVERDUE_ELIGIBLE.includes(paymentStatus as (typeof OVERDUE_ELIGIBLE)[number])) {
    return false
  }
  return isInvoicePastDue(dueAt, today)
}

/**
 * Marks past-due invoices as overdue and syncs linked reservation payment snapshots.
 * Safe to call on every dashboard / billing load (idempotent).
 */
export async function markOverdueInvoices(
  admin: SupabaseClient,
  hotelId: string,
  today: string = todayISO(),
): Promise<number> {
  const { data: invoices } = await admin
    .from('invoices')
    .select('id, reservation_id, payment_status, due_at')
    .eq('hotel_id', hotelId)
    .in('payment_status', [...OVERDUE_ELIGIBLE])

  const toMark = (invoices ?? []).filter((inv) =>
    shouldMarkInvoiceOverdue(inv.payment_status, inv.due_at, today),
  )

  if (!toMark.length) return 0

  for (const inv of toMark) {
    await admin
      .from('invoices')
      .update({ payment_status: 'overdue' })
      .eq('id', inv.id)

    if (inv.reservation_id) {
      await syncReservationPaymentFromInvoice(admin, inv.reservation_id)
    }
  }

  return toMark.length
}
