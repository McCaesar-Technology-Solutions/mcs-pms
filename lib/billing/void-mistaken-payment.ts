import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentStatus } from '@/types'
import { deriveInvoicePaymentStatus } from '@/lib/billing/invoice-payments'
import { syncReservationPaymentFromInvoice } from '@/lib/billing/reservation-payment'

export type VoidablePaymentRecord = {
  id: string
  provider: string
  status: string
  amount: number
  invoice_id?: string | null
  reservation_id?: string | null
  metadata?: unknown
}

export type VoidMistakenPaymentPlan =
  | { ok: false; error: string }
  | {
      ok: true
      voidRecordIds: string[]
      voidedAmount: number
      remainingPaid: number
      nextStatus: PaymentStatus
      cacheOnly: boolean
    }

const ONLINE_PROVIDERS = new Set(['paystack', 'hubtel'])

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isSuccess(record: VoidablePaymentRecord): boolean {
  return record.status === 'success'
}

function isDeskProvider(provider: string): boolean {
  return provider === 'manual'
}

/**
 * Owner correction when staff marked a stay paid without collecting.
 * Voids successful front-desk (manual) ledger rows only. Online charges stay
 * and must be refunded through the PSP if money actually moved.
 */
export function planVoidMistakenDeskPayment(input: {
  paymentStatus: string | null
  totalAmount: number
  amountPaid: number
  records: VoidablePaymentRecord[]
}): VoidMistakenPaymentPlan {
  if (input.paymentStatus === 'refunded') {
    return {
      ok: false,
      error: 'This invoice was refunded. Issue a new bill if you still need to collect.',
    }
  }

  const successful = input.records.filter(isSuccess)
  const desk = successful.filter((row) => isDeskProvider(row.provider))
  const online = successful.filter((row) => ONLINE_PROVIDERS.has(row.provider))
  const otherSuccess = successful.filter(
    (row) => !isDeskProvider(row.provider) && !ONLINE_PROVIDERS.has(row.provider),
  )

  const remainingPaid = round2(
    [...online, ...otherSuccess].reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  )
  const voidedAmount = round2(desk.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))

  if (desk.length > 0) {
    return {
      ok: true,
      voidRecordIds: desk.map((row) => row.id),
      voidedAmount,
      remainingPaid,
      nextStatus: deriveInvoicePaymentStatus(input.totalAmount, remainingPaid, null),
      cacheOnly: false,
    }
  }

  if (online.length > 0 || otherSuccess.length > 0) {
    return {
      ok: false,
      error:
        'This invoice has online payments. Use refund to return Paystack/Hubtel money. Void only clears desk (cash/keyed) flags.',
    }
  }

  if (
    Number(input.amountPaid ?? 0) <= 0.009 &&
    (input.paymentStatus !== 'paid' || Number(input.totalAmount ?? 0) <= 0.009)
  ) {
    return { ok: false, error: 'No desk payment to void on this invoice.' }
  }

  return {
    ok: true,
    voidRecordIds: [],
    voidedAmount: round2(Number(input.amountPaid ?? 0)),
    remainingPaid: 0,
    nextStatus: deriveInvoicePaymentStatus(input.totalAmount, 0, null),
    cacheOnly: true,
  }
}

function mergeVoidMetadata(
  metadata: unknown,
  input: { reason?: string | null; at: string },
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {}
  return {
    ...base,
    voided_at: input.at,
    void_reason: input.reason ?? null,
  }
}

export async function applyVoidMistakenDeskPayment(
  admin: SupabaseClient,
  input: {
    hotelId: string
    invoiceId: string
    reason?: string | null
  },
): Promise<
  | {
      ok: true
      voidedAmount: number
      remainingPaid: number
      paymentStatus: PaymentStatus
      invoiceId: string
      reservationId: string | null
    }
  | { ok: false; error: string }
> {
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, reservation_id, total_amount, amount_paid, payment_status, paid_at')
    .eq('id', input.invoiceId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!invoice) return { ok: false, error: 'Invoice not found.' }

  const { data: invoiceRecords } = await admin
    .from('payment_records')
    .select('id, provider, status, amount, invoice_id, reservation_id, metadata')
    .eq('hotel_id', input.hotelId)
    .eq('invoice_id', input.invoiceId)

  const records: VoidablePaymentRecord[] = [...(invoiceRecords ?? [])]

  if (invoice.reservation_id) {
    const { count } = await admin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', input.hotelId)
      .eq('reservation_id', invoice.reservation_id)

    if ((count ?? 0) <= 1) {
      const { data: unlinked } = await admin
        .from('payment_records')
        .select('id, provider, status, amount, invoice_id, reservation_id, metadata')
        .eq('hotel_id', input.hotelId)
        .eq('reservation_id', invoice.reservation_id)
        .is('invoice_id', null)

      for (const row of unlinked ?? []) {
        if (!records.some((existing) => existing.id === row.id)) {
          records.push(row)
        }
      }
    }
  }

  const plan = planVoidMistakenDeskPayment({
    paymentStatus: invoice.payment_status,
    totalAmount: Number(invoice.total_amount ?? 0),
    amountPaid: Number(invoice.amount_paid ?? 0),
    records,
  })

  if (!plan.ok) return plan

  const now = new Date().toISOString()
  const recordById = new Map(records.map((row) => [row.id, row]))

  for (const id of plan.voidRecordIds) {
    const row = recordById.get(id)
    await admin
      .from('payment_records')
      .update({
        status: 'voided',
        metadata: mergeVoidMetadata(row?.metadata, { reason: input.reason, at: now }),
      })
      .eq('id', id)
      .eq('hotel_id', input.hotelId)
  }

  const { error } = await admin
    .from('invoices')
    .update({
      amount_paid: plan.remainingPaid,
      payment_status: plan.nextStatus,
      paid_at: plan.nextStatus === 'paid' ? (invoice.paid_at ?? now) : null,
    })
    .eq('id', invoice.id)
    .eq('hotel_id', input.hotelId)

  if (error) return { ok: false, error: error.message }

  if (invoice.reservation_id) {
    await syncReservationPaymentFromInvoice(admin, invoice.reservation_id)
  }

  return {
    ok: true,
    voidedAmount: plan.voidedAmount,
    remainingPaid: plan.remainingPaid,
    paymentStatus: plan.nextStatus,
    invoiceId: invoice.id,
    reservationId: invoice.reservation_id,
  }
}