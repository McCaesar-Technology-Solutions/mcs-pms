import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppOrigin } from '@/lib/env'
import { getPaymentProvider } from '@/lib/payments/get-provider'
import { ghsToPesewas } from '@/lib/payments/paystack'
import { invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import type { Database } from '@/lib/supabase/types'

type AdminClient = SupabaseClient<Database>

const DEDUPE_WINDOW_MS = 2 * 60 * 1000

export type InitiatePaymentResult =
  | {
      ok: true
      authorizationUrl: string
      reference: string
      paymentId: string
      reused: boolean
    }
  | { ok: false; error: string }

export async function initiateInvoiceOnlinePayment(
  admin: AdminClient,
  input: {
    hotelId: string
    invoiceId: string
    amountGhs?: number
    initiatedBy: string | null
    guestPortalInitiated: boolean
    callbackPath: string
  },
): Promise<InitiatePaymentResult> {
  const { data: invoice } = await admin
    .from('invoices')
    .select(
      'id, hotel_id, guest_id, reservation_id, guest_name, total_amount, amount_paid, payment_status',
    )
    .eq('id', input.invoiceId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!invoice) return { ok: false, error: 'Invoice not found.' }
  if (invoice.payment_status === 'refunded') {
    return { ok: false, error: 'Invoice has been refunded.' }
  }

  const balance = invoiceBalanceDue(
    Number(invoice.total_amount ?? 0),
    Number(invoice.amount_paid ?? 0),
  )
  if (balance <= 0) return { ok: false, error: 'Invoice is already paid.' }

  const requested =
    input.amountGhs != null && Number.isFinite(input.amountGhs)
      ? Math.round(input.amountGhs * 100) / 100
      : balance
  const amount = Math.min(requested, balance)
  if (amount <= 0) return { ok: false, error: 'Invalid payment amount.' }

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  const { data: recent } = await admin
    .from('payments')
    .select('id, status, authorization_url, provider_reference, amount')
    .eq('hotel_id', input.hotelId)
    .eq('invoice_id', input.invoiceId)
    .eq('amount', amount)
    .in('status', ['pending', 'success'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent?.status === 'success') {
    return { ok: false, error: 'A matching payment was just completed. Refresh to confirm.' }
  }

  if (recent?.status === 'pending' && recent.authorization_url) {
    return {
      ok: true,
      authorizationUrl: recent.authorization_url,
      reference: recent.provider_reference,
      paymentId: recent.id,
      reused: true,
    }
  }

  let email: string | null = null
  if (invoice.guest_id) {
    const { data: guest } = await admin
      .from('guests')
      .select('email')
      .eq('id', invoice.guest_id)
      .eq('hotel_id', input.hotelId)
      .maybeSingle()
    email = guest?.email?.trim() || null
  }

  if (!email) {
    return {
      ok: false,
      error: 'Guest email is required for online payment. Add an email on the guest profile first.',
    }
  }

  const reference = `pay_${input.hotelId.slice(0, 8)}_${randomUUID()}`
  const provider = getPaymentProvider('paystack')
  const callbackUrl = `${getAppOrigin()}${input.callbackPath}`

  let initialized: { authorizationUrl: string; reference: string }
  try {
    initialized = await provider.initialize({
      amountKobo: ghsToPesewas(amount),
      email,
      reference,
      callbackUrl,
      currency: 'GHS',
      metadata: {
        hotel_id: input.hotelId,
        invoice_id: invoice.id,
        guest_id: invoice.guest_id,
        reservation_id: invoice.reservation_id,
        guest_portal: input.guestPortalInitiated,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start payment.'
    return { ok: false, error: message }
  }

  const now = new Date().toISOString()
  const { data: row, error } = await admin
    .from('payments')
    .insert({
      hotel_id: input.hotelId,
      guest_id: invoice.guest_id,
      reservation_id: invoice.reservation_id,
      invoice_id: invoice.id,
      provider: 'paystack',
      provider_reference: initialized.reference,
      amount,
      currency: 'GHS',
      status: 'pending',
      initiated_by: input.initiatedBy,
      guest_portal_initiated: input.guestPortalInitiated,
      authorization_url: initialized.authorizationUrl,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !row) {
    return { ok: false, error: error?.message ?? 'Could not record payment attempt.' }
  }

  return {
    ok: true,
    authorizationUrl: initialized.authorizationUrl,
    reference: initialized.reference,
    paymentId: row.id,
    reused: false,
  }
}
