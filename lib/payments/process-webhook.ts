import type { SupabaseClient } from '@supabase/supabase-js'
import { applyInvoicePaymentRecord } from '@/lib/billing/apply-payment'
import { applyOnlineReservationDeposit } from '@/lib/payments/apply-deposit'
import { writeAuditLog } from '@/lib/audit/log'
import { paystackChannelToPaymentMethod } from '@/lib/payments/channel-to-method'
import { pesewasToGhs } from '@/lib/payments/paystack'
import type { PaymentWebhookEvent } from '@/lib/payments/provider'
import { enqueueEmailOutbox, enqueueSmsOutbox } from '@/lib/notifications/outbox'
import { appUrl } from '@/lib/notifications/app-url'
import type { Database, Json } from '@/lib/supabase/types'

type AdminClient = SupabaseClient<Database>

export type ProcessWebhookResult =
  | { handled: true; reason: 'applied' | 'already_terminal' | 'ignored' | 'failed_marked' }
  | { handled: false; error: string }

/**
 * Apply a verified Paystack webhook event to the payments ledger + invoice.
 * Caller must verify the signature before invoking this.
 */
export async function processPaystackWebhookEvent(
  admin: AdminClient,
  event: PaymentWebhookEvent,
): Promise<ProcessWebhookResult> {
  if (event.type === 'ignored' || !event.reference) {
    return { handled: true, reason: 'ignored' }
  }

  const { data: existing } = await admin
    .from('payments')
    .select(
      'id, hotel_id, guest_id, invoice_id, reservation_id, amount, status, provider_reference, initiated_by',
    )
    .eq('provider_reference', event.reference)
    .maybeSingle()

  if (!existing) {
    return { handled: false, error: 'Unknown payment reference' }
  }

  if (existing.status === 'success' || existing.status === 'refunded') {
    return { handled: true, reason: 'already_terminal' }
  }

  if (event.type === 'charge.failed') {
    const { data: failedRows } = await admin
      .from('payments')
      .update({
        status: 'failed',
        provider_transaction_id: event.providerTransactionId,
        channel: event.channel,
        raw_webhook_payload: event.raw as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('status', 'pending')
      .select('id')

    if (!failedRows?.length) {
      return { handled: true, reason: 'already_terminal' }
    }

    void writeAuditLog({
      hotelId: existing.hotel_id,
      actorId: existing.initiated_by,
      actorName: 'Paystack',
      entityType: 'payment',
      entityId: existing.id,
      action: 'payment_failed',
      summary: `Online payment failed (${event.reference})`,
      details: { reference: event.reference, channel: event.channel },
    })

    return { handled: true, reason: 'failed_marked' }
  }

  // charge.success
  if (event.amountPesewas != null) {
    const webhookGhs = pesewasToGhs(event.amountPesewas)
    if (Math.abs(webhookGhs - Number(existing.amount)) > 0.009) {
      return { handled: false, error: 'Amount mismatch' }
    }
  }

  const now = new Date().toISOString()
  const { data: updatedRows } = await admin
    .from('payments')
    .update({
      status: 'success',
      provider_transaction_id: event.providerTransactionId,
      channel: event.channel,
      raw_webhook_payload: event.raw as Json,
      updated_at: now,
    })
    .eq('id', existing.id)
    .eq('status', 'pending')
    .select('id')

  if (!updatedRows?.length) {
    return { handled: true, reason: 'already_terminal' }
  }

  const paymentMethod = paystackChannelToPaymentMethod(event.channel)

  if (existing.invoice_id) {
    const applyResult = await applyInvoicePaymentRecord(admin, {
      invoiceId: existing.invoice_id,
      hotelId: existing.hotel_id,
      amount: Number(existing.amount),
      paymentMethod,
      provider: 'paystack',
      providerReference: existing.provider_reference,
      idempotencyKey: `paystack:${existing.provider_reference}`,
    })

    if (!applyResult.ok) {
      return { handled: false, error: applyResult.error }
    }
  } else if (existing.reservation_id) {
    const depositResult = await applyOnlineReservationDeposit(admin, {
      hotelId: existing.hotel_id,
      reservationId: existing.reservation_id,
      amount: Number(existing.amount),
      paymentMethod,
      providerReference: existing.provider_reference,
      actorId: existing.initiated_by,
    })

    if (!depositResult.ok) {
      return { handled: false, error: depositResult.error }
    }
  }

  void writeAuditLog({
    hotelId: existing.hotel_id,
    actorId: existing.initiated_by,
    actorName: 'Paystack',
    entityType: existing.invoice_id
      ? 'invoice'
      : existing.reservation_id
        ? 'reservation'
        : 'payment',
    entityId: existing.invoice_id ?? existing.reservation_id ?? existing.id,
    action: existing.invoice_id ? 'payment_online' : 'deposit_online',
    summary: `Online payment of GHS ${Number(existing.amount).toFixed(2)} received`,
    details: {
      paymentId: existing.id,
      reference: event.reference,
      channel: event.channel,
      providerTransactionId: event.providerTransactionId,
    },
  })

  if (existing.guest_id) {
    void queuePaymentReceiptNotification(admin, {
      hotelId: existing.hotel_id,
      guestId: existing.guest_id,
      invoiceId: existing.invoice_id,
      amount: Number(existing.amount),
      reference: existing.provider_reference,
    }).catch((err) => {
      console.error('[paystack-webhook] receipt enqueue failed', err)
    })
  }

  return { handled: true, reason: 'applied' }
}

async function queuePaymentReceiptNotification(
  admin: AdminClient,
  input: {
    hotelId: string
    guestId: string
    invoiceId: string | null
    amount: number
    reference: string
  },
): Promise<void> {
  const { data: guest } = await admin
    .from('guests')
    .select('name, email, phone')
    .eq('id', input.guestId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!guest) return

  let invoiceLabel = input.reference
  if (input.invoiceId) {
    const { data: invoice } = await admin
      .from('invoices')
      .select('invoice_number')
      .eq('id', input.invoiceId)
      .eq('hotel_id', input.hotelId)
      .maybeSingle()
    if (invoice?.invoice_number) invoiceLabel = invoice.invoice_number
  }

  const amountLabel = `GHS ${input.amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
  const idempotencyKey = `payment-receipt:${input.reference}`

  if (guest.email?.trim()) {
    await enqueueEmailOutbox({
      hotelId: input.hotelId,
      email: guest.email.trim(),
      content: {
        subject: `Payment received · ${invoiceLabel}`,
        preview: `We received your payment of ${amountLabel}.`,
        lines: [
          `Hi ${guest.name ?? 'Guest'},`,
          `We received your payment of ${amountLabel}.`,
          `Reference: ${input.reference}`,
          `Invoice: ${invoiceLabel}`,
          'Thank you for staying with us.',
        ],
        actionUrl: appUrl('/guest'),
        actionLabel: 'Open guest portal',
      },
      templateKey: 'guest_receipt',
      idempotencyKey: `${idempotencyKey}:email`,
    })
  }

  if (guest.phone?.trim()) {
    await enqueueSmsOutbox({
      hotelId: input.hotelId,
      phone: guest.phone.trim(),
      body: `Payment of ${amountLabel} received. Ref: ${input.reference}. Thank you.`,
      templateKey: 'guest_receipt',
      idempotencyKey: `${idempotencyKey}:sms`,
    })
  }
}
