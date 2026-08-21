import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod, PaymentStatus, ReservationPaymentStatus } from '@/types'
import { applyInvoicePaymentRecord } from '@/lib/billing/apply-payment'
import { invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import {
  derivePreCheckoutPaymentStatus,
  mapInvoicePaymentStatusToReservation,
  reservationBalanceDue,
  syncReservationPaymentFromInvoice,
} from '@/lib/billing/reservation-payment'

export type StayPaymentPhase = 'pre_arrival' | 'check_in' | 'in_stay' | 'checkout'

export type ApplyStayPaymentSuccess = {
  ok: true
  amountApplied: number
  balanceDue: number
  invoiceId: string | null
  reservationId: string | null
  paymentStatus: PaymentStatus | ReservationPaymentStatus
}

export type ApplyStayPaymentResult = ApplyStayPaymentSuccess | { ok: false; error: string }

const PRE_INVOICE_STATUSES = ['provisional', 'confirmed', 'pre_arrival', 'checked_in', 'overstay'] as const

export async function findStayInvoicesForReservation(
  admin: SupabaseClient,
  hotelId: string,
  reservationId: string,
): Promise<
  Array<{
    id: string
    reservation_id: string | null
    total_amount: number | null
    amount_paid: number | null
    payment_status: string | null
  }>
> {
  const { data } = await admin
    .from('invoices')
    .select('id, reservation_id, total_amount, amount_paid, payment_status, billing_period_start')
    .eq('hotel_id', hotelId)
    .eq('reservation_id', reservationId)
    .order('billing_period_start', { ascending: true })

  return data ?? []
}

export async function findStayInvoiceForReservation(
  admin: SupabaseClient,
  hotelId: string,
  reservationId: string,
): Promise<{
  id: string
  reservation_id: string | null
  total_amount: number | null
  amount_paid: number | null
  payment_status: string | null
} | null> {
  const invoices = await findStayInvoicesForReservation(admin, hotelId, reservationId)
  const billable = invoices.filter((inv) => Number(inv.total_amount ?? 0) > 0.009)
  const pool = billable.length > 0 ? billable : invoices
  const open = pool.find(
    (inv) => invoiceBalanceDue(Number(inv.total_amount ?? 0), Number(inv.amount_paid ?? 0)) > 0.009,
  )
  return open ?? pool[pool.length - 1] ?? null
}

/** Apply a payment oldest-open-first across stay invoices (original, then extensions). */
export async function applyStayPaymentWaterfall(
  admin: SupabaseClient,
  input: {
    hotelId: string
    reservationId: string
    amount: number
    paymentMethod: PaymentMethod
    provider: 'manual' | 'paystack' | 'hubtel'
    providerReference?: string
    idempotencyKeyPrefix: string
    metadata?: Record<string, unknown>
    phase?: StayPaymentPhase
  },
): Promise<ApplyStayPaymentResult> {
  let remainingPay = Math.max(0, input.amount)
  let amountApplied = 0
  let last: ApplyStayPaymentSuccess | null = null
  const seen = new Set<string>()

  while (remainingPay > 0.009) {
    const invoices = await findStayInvoicesForReservation(admin, input.hotelId, input.reservationId)
    const next = invoices.find(
      (inv) =>
        !seen.has(inv.id) &&
        invoiceBalanceDue(Number(inv.total_amount ?? 0), Number(inv.amount_paid ?? 0)) > 0.009,
    )
    if (!next) break
    seen.add(next.id)

    const paymentResult = await applyStayPayment(admin, {
      hotelId: input.hotelId,
      reservationId: input.reservationId,
      invoiceId: next.id,
      amount: remainingPay,
      paymentMethod: input.paymentMethod,
      provider: input.provider,
      providerReference: input.providerReference,
      idempotencyKey: `${input.idempotencyKeyPrefix}:${next.id}`,
      metadata: input.metadata,
      phase: input.phase,
    })
    if (!paymentResult.ok) return paymentResult

    amountApplied += paymentResult.amountApplied
    remainingPay = Math.round((remainingPay - paymentResult.amountApplied) * 100) / 100
    last = paymentResult
    if (paymentResult.amountApplied <= 0.009) break
  }

  if (!last) {
    const invoice = await findStayInvoiceForReservation(admin, input.hotelId, input.reservationId)
    return {
      ok: true,
      amountApplied: 0,
      balanceDue: 0,
      invoiceId: invoice?.id ?? null,
      reservationId: input.reservationId,
      paymentStatus: 'paid',
    }
  }

  return {
    ...last,
    amountApplied,
  }
}

async function applyPreInvoiceReservationPayment(
  admin: SupabaseClient,
  input: {
    hotelId: string
    reservationId: string
    amount: number
    paymentMethod: PaymentMethod
    provider: 'manual' | 'paystack' | 'hubtel'
    providerReference?: string
    idempotencyKey: string
    metadata?: Record<string, unknown>
  },
): Promise<ApplyStayPaymentResult> {
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, guest_id, status, total_amount, amount_paid')
    .eq('id', input.reservationId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!reservation) return { ok: false, error: 'Reservation not found.' }
  if (
    !PRE_INVOICE_STATUSES.includes(
      (reservation.status ?? '') as (typeof PRE_INVOICE_STATUSES)[number],
    )
  ) {
    return { ok: false, error: 'Payments can only be recorded before check-out.' }
  }

  const total = Number(reservation.total_amount ?? 0)
  const currentPaid = Number(reservation.amount_paid ?? 0)
  const balance = reservationBalanceDue(total, currentPaid)
  if (balance <= 0) {
    return {
      ok: true,
      amountApplied: 0,
      balanceDue: 0,
      invoiceId: null,
      reservationId: reservation.id,
      paymentStatus: derivePreCheckoutPaymentStatus(total, currentPaid),
    }
  }

  const payAmount = Math.min(input.amount, balance)
  if (payAmount <= 0) {
    return {
      ok: true,
      amountApplied: 0,
      balanceDue: balance,
      invoiceId: null,
      reservationId: reservation.id,
      paymentStatus: derivePreCheckoutPaymentStatus(total, currentPaid),
    }
  }

  const now = new Date().toISOString()
  const { data: existingPayment } = await admin
    .from('payment_records')
    .select('id, status')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle()

  if (existingPayment?.status === 'success') {
    const paid = Number(reservation.amount_paid ?? 0)
    return {
      ok: true,
      amountApplied: 0,
      balanceDue: reservationBalanceDue(total, paid),
      invoiceId: null,
      reservationId: reservation.id,
      paymentStatus: derivePreCheckoutPaymentStatus(total, paid),
    }
  }

  if (!existingPayment) {
    await admin.from('payment_records').insert({
      hotel_id: input.hotelId,
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      provider: input.provider,
      provider_reference: input.providerReference ?? null,
      amount: payAmount,
      currency: 'GHS',
      status: 'success',
      idempotency_key: input.idempotencyKey,
      completed_at: now,
      metadata: { ...(input.metadata ?? {}), paymentMethod: input.paymentMethod },
    })
  }

  const newPaid = Math.round((currentPaid + payAmount) * 100) / 100
  const paymentStatus = derivePreCheckoutPaymentStatus(total, newPaid)

  await admin
    .from('reservations')
    .update({
      amount_paid: newPaid,
      payment_method: input.paymentMethod,
      payment_status: paymentStatus,
    })
    .eq('id', reservation.id)

  return {
    ok: true,
    amountApplied: payAmount,
    balanceDue: reservationBalanceDue(total, newPaid),
    invoiceId: null,
    reservationId: reservation.id,
    paymentStatus,
  }
}

/**
 * Single entry point for stay-linked payments.
 * Uses the stay invoice when one exists; otherwise records on the reservation (pre-invoice deposits).
 */
export async function applyStayPayment(
  admin: SupabaseClient,
  input: {
    hotelId: string
    reservationId?: string
    invoiceId?: string
    amount: number
    paymentMethod: PaymentMethod
    provider: 'manual' | 'paystack' | 'hubtel'
    providerReference?: string
    idempotencyKey: string
    metadata?: Record<string, unknown>
    phase?: StayPaymentPhase
  },
): Promise<ApplyStayPaymentResult> {
  void input.phase

  let invoiceId = input.invoiceId ?? null
  let reservationId = input.reservationId ?? null

  if (invoiceId && !reservationId) {
    const { data: invoice } = await admin
      .from('invoices')
      .select('id, reservation_id, total_amount, amount_paid, payment_status')
      .eq('id', invoiceId)
      .eq('hotel_id', input.hotelId)
      .maybeSingle()

    if (!invoice) return { ok: false, error: 'Invoice not found.' }
    reservationId = invoice.reservation_id
  }

  if (reservationId && !invoiceId) {
    const invoice = await findStayInvoiceForReservation(admin, input.hotelId, reservationId)
    invoiceId = invoice?.id ?? null
  }

  if (invoiceId) {
    const result = await applyInvoicePaymentRecord(admin, {
      invoiceId,
      hotelId: input.hotelId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      provider: input.provider,
      providerReference: input.providerReference,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    })

    if (!result.ok) return result

    return {
      ok: true,
      amountApplied: result.amountApplied,
      balanceDue: result.balanceDue,
      invoiceId: result.invoiceId,
      reservationId: result.reservationId,
      paymentStatus: result.paymentStatus,
    }
  }

  if (!reservationId) {
    return { ok: false, error: 'Specify a reservation or invoice.' }
  }

  return applyPreInvoiceReservationPayment(admin, {
    hotelId: input.hotelId,
    reservationId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    provider: input.provider,
    providerReference: input.providerReference,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  })
}

export { syncReservationPaymentFromInvoice, mapInvoicePaymentStatusToReservation }
