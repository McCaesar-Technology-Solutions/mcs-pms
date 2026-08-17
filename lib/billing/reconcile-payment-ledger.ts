import type { SupabaseClient } from '@supabase/supabase-js'
import { linkDepositRecordsToInvoice } from '@/lib/billing/reservation-payment'

export type ReconcilePaymentLedgerResult = {
  reservationBackfills: number
  invoiceBackfills: number
  recordsLinked: number
  reservationGapsGhs: number
  invoiceGapsGhs: number
}

type ReconcileOptions = {
  dryRun?: boolean
}

async function sumPaymentRecords(
  admin: SupabaseClient,
  filter: { reservationId?: string; invoiceId?: string },
): Promise<number> {
  let query = admin
    .from('payment_records')
    .select('amount')
    .eq('status', 'success')

  if (filter.reservationId) query = query.eq('reservation_id', filter.reservationId)
  if (filter.invoiceId) query = query.eq('invoice_id', filter.invoiceId)

  const { data } = await query
  return Math.round((data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0) * 100) / 100
}

/**
 * Align payment_records with cached amount_paid on reservations/invoices.
 * Inserts synthetic manual rows (metadata.backfill) when ledger rows are missing.
 */
export async function reconcilePaymentLedger(
  admin: SupabaseClient,
  hotelId: string,
  opts: ReconcileOptions = {},
): Promise<ReconcilePaymentLedgerResult> {
  const dryRun = opts.dryRun ?? false
  const now = new Date().toISOString()
  const result: ReconcilePaymentLedgerResult = {
    reservationBackfills: 0,
    invoiceBackfills: 0,
    recordsLinked: 0,
    reservationGapsGhs: 0,
    invoiceGapsGhs: 0,
  }

  const { data: reservations } = await admin
    .from('reservations')
    .select('id, guest_id, amount_paid, payment_method')
    .eq('hotel_id', hotelId)
    .gt('amount_paid', 0)

  for (const reservation of reservations ?? []) {
    const cached = Number(reservation.amount_paid ?? 0)
    const recorded = await sumPaymentRecords(admin, { reservationId: reservation.id })
    const gap = Math.round((cached - recorded) * 100) / 100
    if (gap <= 0.009) continue

    result.reservationGapsGhs += gap
    if (dryRun) {
      result.reservationBackfills += 1
      continue
    }

    await admin.from('payment_records').insert({
      hotel_id: hotelId,
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      provider: 'manual',
      amount: gap,
      currency: 'GHS',
      status: 'success',
      idempotency_key: `backfill:reservation:${reservation.id}`,
      completed_at: now,
      metadata: {
        backfill: true,
        source: 'reconcile_payment_ledger',
        paymentMethod: reservation.payment_method ?? 'cash',
      },
    })
    result.reservationBackfills += 1
  }

  const { data: invoices } = await admin
    .from('invoices')
    .select('id, reservation_id, guest_id, amount_paid, payment_method')
    .eq('hotel_id', hotelId)
    .gt('amount_paid', 0)

  for (const invoice of invoices ?? []) {
    const cached = Number(invoice.amount_paid ?? 0)
    const recorded = await sumPaymentRecords(admin, { invoiceId: invoice.id })
    const gap = Math.round((cached - recorded) * 100) / 100
    if (gap <= 0.009) continue

    result.invoiceGapsGhs += gap
    if (dryRun) {
      result.invoiceBackfills += 1
      continue
    }

    await admin.from('payment_records').insert({
      hotel_id: hotelId,
      invoice_id: invoice.id,
      reservation_id: invoice.reservation_id,
      guest_id: invoice.guest_id,
      provider: 'manual',
      amount: gap,
      currency: 'GHS',
      status: 'success',
      idempotency_key: `backfill:invoice:${invoice.id}`,
      completed_at: now,
      metadata: {
        backfill: true,
        source: 'reconcile_payment_ledger',
        paymentMethod: invoice.payment_method ?? 'cash',
      },
    })
    result.invoiceBackfills += 1
  }

  const { data: stayInvoices } = await admin
    .from('invoices')
    .select('id, reservation_id')
    .eq('hotel_id', hotelId)
    .not('reservation_id', 'is', null)

  for (const invoice of stayInvoices ?? []) {
    if (!invoice.reservation_id) continue
    if (dryRun) {
      const { count } = await admin
        .from('payment_records')
        .select('id', { count: 'exact', head: true })
        .eq('reservation_id', invoice.reservation_id)
        .is('invoice_id', null)
        .eq('status', 'success')
      result.recordsLinked += count ?? 0
      continue
    }

    const { count: before } = await admin
      .from('payment_records')
      .select('id', { count: 'exact', head: true })
      .eq('reservation_id', invoice.reservation_id)
      .is('invoice_id', null)
      .eq('status', 'success')

    await linkDepositRecordsToInvoice(admin, invoice.reservation_id, invoice.id)

    const { count: after } = await admin
      .from('payment_records')
      .select('id', { count: 'exact', head: true })
      .eq('reservation_id', invoice.reservation_id)
      .is('invoice_id', null)
      .eq('status', 'success')

    result.recordsLinked += Math.max(0, (before ?? 0) - (after ?? 0))
  }

  return result
}
