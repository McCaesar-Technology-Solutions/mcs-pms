import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod, PaymentStatus, ReservationPaymentStatus } from '@/types'
import { deriveInvoicePaymentStatus, invoiceBalanceDue } from '@/lib/billing/invoice-payments'

export function derivePreCheckoutPaymentStatus(
  totalAmount: number,
  amountPaid: number,
): ReservationPaymentStatus {
  if (totalAmount <= 0) return 'complimentary'
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid + 0.009 >= totalAmount) return 'paid'
  return 'deposit_paid'
}

export function reservationBalanceDue(totalAmount: number, amountPaid: number): number {
  return invoiceBalanceDue(totalAmount, amountPaid)
}

export function buildCheckoutInvoicePaymentState(input: {
  invoiceTotal: number
  priorDeposit: number
  paidNow: boolean
}): { amountPaid: number; paymentStatus: PaymentStatus } {
  const invoiceTotal = Math.max(0, input.invoiceTotal)
  const priorDeposit = Math.max(0, input.priorDeposit)

  if (input.paidNow) {
    return { amountPaid: invoiceTotal, paymentStatus: 'paid' }
  }

  const applied = Math.min(priorDeposit, invoiceTotal)
  return {
    amountPaid: applied,
    paymentStatus: deriveInvoicePaymentStatus(invoiceTotal, applied, null),
  }
}

export async function syncReservationPaymentFromInvoice(
  admin: SupabaseClient,
  reservationId: string,
): Promise<void> {
  const { data: invoice } = await admin
    .from('invoices')
    .select('total_amount, amount_paid, payment_status, payment_method')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (!invoice) return

  await admin
    .from('reservations')
    .update({
      total_amount: Number(invoice.total_amount ?? 0),
      amount_paid: Number(invoice.amount_paid ?? 0),
      payment_status: (invoice.payment_status ?? 'pending') as ReservationPaymentStatus,
      payment_method: invoice.payment_method as PaymentMethod | null,
    })
    .eq('id', reservationId)
}

export async function refreshPreCheckoutPaymentStatus(
  admin: SupabaseClient,
  reservationId: string,
  paymentMethod?: PaymentMethod,
): Promise<void> {
  const { data: reservation } = await admin
    .from('reservations')
    .select('total_amount, amount_paid, status')
    .eq('id', reservationId)
    .maybeSingle()

  if (!reservation || reservation.status === 'checked_out') return

  const total = Number(reservation.total_amount ?? 0)
  const paid = Number(reservation.amount_paid ?? 0)
  const paymentStatus = derivePreCheckoutPaymentStatus(total, paid)

  await admin
    .from('reservations')
    .update({
      payment_status: paymentStatus,
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    })
    .eq('id', reservationId)
}

export async function linkDepositRecordsToInvoice(
  admin: SupabaseClient,
  reservationId: string,
  invoiceId: string,
): Promise<void> {
  await admin
    .from('payment_records')
    .update({ invoice_id: invoiceId })
    .eq('reservation_id', reservationId)
    .is('invoice_id', null)
    .eq('status', 'success')
}

export async function createCheckoutPaymentRecords(
  admin: SupabaseClient,
  input: {
    hotelId: string
    invoiceId: string
    guestId: string | null
    reservationId: string
    invoiceTotal: number
    priorDeposit: number
    paidNow: boolean
    paymentMethod: PaymentMethod
    now: string
  },
): Promise<void> {
  await linkDepositRecordsToInvoice(admin, input.reservationId, input.invoiceId)

  const remainder = Math.max(
    0,
    Math.round((input.invoiceTotal - Math.min(input.priorDeposit, input.invoiceTotal)) * 100) / 100,
  )

  if (input.paidNow && remainder > 0.009) {
    await admin.from('payment_records').insert({
      hotel_id: input.hotelId,
      invoice_id: input.invoiceId,
      reservation_id: input.reservationId,
      guest_id: input.guestId,
      provider: 'manual',
      amount: remainder,
      currency: 'GHS',
      status: 'success',
      idempotency_key: `checkout:${input.invoiceId}:${input.now}`,
      completed_at: input.now,
      metadata: { source: 'checkout_balance' },
    })
  } else if (input.paidNow && input.priorDeposit <= 0.009 && input.invoiceTotal > 0) {
    await admin.from('payment_records').insert({
      hotel_id: input.hotelId,
      invoice_id: input.invoiceId,
      reservation_id: input.reservationId,
      guest_id: input.guestId,
      provider: 'manual',
      amount: input.invoiceTotal,
      currency: 'GHS',
      status: 'success',
      idempotency_key: `checkout:${input.invoiceId}:full`,
      completed_at: input.now,
      metadata: { source: 'checkout_full' },
    })
  }
}

export async function finalizeReservationCheckoutPayment(
  admin: SupabaseClient,
  input: {
    reservationId: string
    invoiceId: string
    hotelId: string
    guestId: string | null
    invoiceTotal: number
    priorDeposit: number
    paidNow: boolean
    paymentMethod: PaymentMethod
    now: string
  },
): Promise<void> {
  await createCheckoutPaymentRecords(admin, input)
  await syncReservationPaymentFromInvoice(admin, input.reservationId)
}
