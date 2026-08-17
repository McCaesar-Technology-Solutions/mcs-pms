import type { SupabaseClient } from '@supabase/supabase-js'

export async function sumSuccessfulPaymentsForInvoice(
  admin: SupabaseClient,
  invoiceId: string,
): Promise<number> {
  const { data } = await admin
    .from('payment_records')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('status', 'success')

  return Math.round((data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0) * 100) / 100
}

export async function sumSuccessfulPaymentsForReservation(
  admin: SupabaseClient,
  reservationId: string,
): Promise<number> {
  const { data } = await admin
    .from('payment_records')
    .select('amount')
    .eq('reservation_id', reservationId)
    .eq('status', 'success')

  return Math.round((data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0) * 100) / 100
}

/**
 * Highest trusted collected amount: ledger sum, invoice cache, reservation cache.
 */
export async function resolveCollectedAmount(
  admin: SupabaseClient,
  input: {
    invoiceId?: string | null
    reservationId?: string | null
    invoiceAmountPaid?: number | null
    reservationAmountPaid?: number | null
  },
): Promise<number> {
  const cached = Math.max(
    0,
    Number(input.invoiceAmountPaid ?? 0),
    Number(input.reservationAmountPaid ?? 0),
  )

  let ledger = 0
  if (input.invoiceId) {
    ledger = Math.max(ledger, await sumSuccessfulPaymentsForInvoice(admin, input.invoiceId))
  }
  if (input.reservationId) {
    ledger = Math.max(ledger, await sumSuccessfulPaymentsForReservation(admin, input.reservationId))
  }

  return Math.round(Math.max(cached, ledger) * 100) / 100
}

export function mergeCollectedAmount(
  invoiceAmountPaid: number,
  reservationAmountPaid: number,
  ledgerAmountPaid: number,
): number {
  return Math.round(Math.max(invoiceAmountPaid, reservationAmountPaid, ledgerAmountPaid, 0) * 100) / 100
}
