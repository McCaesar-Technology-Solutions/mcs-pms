import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod, PaymentStatus, ReservationPaymentStatus } from '@/types'
import { applyStayPayment } from '@/lib/billing/apply-stay-payment'
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

export function mapInvoicePaymentStatusToReservation(
  invoiceStatus: string | null | undefined,
  totalAmount: number,
  amountPaid: number,
): ReservationPaymentStatus {
  if (totalAmount <= 0) return 'complimentary'
  const status = invoiceStatus ?? 'pending'
  if (status === 'paid') return 'paid'
  if (status === 'partial') return 'partial'
  if (status === 'overdue') return 'overdue'
  if (status === 'refunded') return 'refunded'
  if (amountPaid > 0.009) return 'partial'
  return 'unpaid'
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

  const total = Number(invoice.total_amount ?? 0)
  const paid = Number(invoice.amount_paid ?? 0)

  await admin
    .from('reservations')
    .update({
      total_amount: total,
      amount_paid: paid,
      payment_status: mapInvoicePaymentStatusToReservation(
        invoice.payment_status,
        total,
        paid,
      ),
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

  if (!input.paidNow) return

  const remainder = Math.max(
    0,
    Math.round((input.invoiceTotal - Math.min(input.priorDeposit, input.invoiceTotal)) * 100) / 100,
  )

  if (remainder <= 0.009) {
    if (input.priorDeposit <= 0.009 && input.invoiceTotal > 0.009) {
      await applyStayPayment(admin, {
        hotelId: input.hotelId,
        reservationId: input.reservationId,
        invoiceId: input.invoiceId,
        amount: input.invoiceTotal,
        paymentMethod: input.paymentMethod,
        provider: 'manual',
        idempotencyKey: `checkout:${input.invoiceId}:full`,
        phase: 'checkout',
        metadata: { source: 'checkout_full' },
      })
    }
    return
  }

  await applyStayPayment(admin, {
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    invoiceId: input.invoiceId,
    amount: remainder,
    paymentMethod: input.paymentMethod,
    provider: 'manual',
    idempotencyKey: `checkout:${input.invoiceId}:${input.now}`,
    phase: 'checkout',
    metadata: { source: 'checkout_balance' },
  })
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
