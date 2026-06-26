import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod } from '@/types'
import { deriveInvoicePaymentStatus, invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import { syncReservationPaymentFromInvoice } from '@/lib/billing/reservation-payment'

export async function applyInvoicePaymentRecord(
  admin: SupabaseClient,
  input: {
    invoiceId: string
    hotelId: string
    amount: number
    paymentMethod: PaymentMethod
    provider: 'manual' | 'paystack' | 'hubtel'
    providerReference?: string
    idempotencyKey: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, guest_id, reservation_id, total_amount, amount_paid, payment_status')
    .eq('id', input.invoiceId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!invoice) return { ok: false, error: 'Invoice not found' }
  if (invoice.payment_status === 'refunded') {
    return { ok: false, error: 'Invoice refunded' }
  }

  const total = Number(invoice.total_amount ?? 0)
  const currentPaid = Number(invoice.amount_paid ?? 0)
  const balance = invoiceBalanceDue(total, currentPaid)
  if (balance <= 0) return { ok: true }

  const payAmount = Math.min(input.amount, balance)
  const newPaid = Math.round((currentPaid + payAmount) * 100) / 100
  const newStatus = deriveInvoicePaymentStatus(total, newPaid, invoice.payment_status)
  const now = new Date().toISOString()

  const { data: existingPayment } = await admin
    .from('payment_records')
    .select('id, status')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle()

  if (existingPayment?.status === 'success') {
    return { ok: true }
  }

  if (!existingPayment) {
    await admin.from('payment_records').insert({
      hotel_id: input.hotelId,
      invoice_id: input.invoiceId,
      reservation_id: invoice.reservation_id,
      guest_id: invoice.guest_id,
      provider: input.provider,
      provider_reference: input.providerReference ?? null,
      amount: payAmount,
      currency: 'GHS',
      status: 'success',
      idempotency_key: input.idempotencyKey,
      completed_at: now,
    })
  } else {
    await admin
      .from('payment_records')
      .update({ status: 'success', completed_at: now, amount: payAmount })
      .eq('id', existingPayment.id)
  }

  await admin
    .from('invoices')
    .update({
      amount_paid: newPaid,
      payment_status: newStatus,
      payment_method: input.paymentMethod,
      paid_at: newStatus === 'paid' ? now : null,
    })
    .eq('id', input.invoiceId)

  if (invoice.reservation_id) {
    await syncReservationPaymentFromInvoice(admin, invoice.reservation_id)
  }

  return { ok: true }
}
