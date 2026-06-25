'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/get-profile'
import { getGuestFromSession } from '@/app/actions/guest'
import {
  buildPaystackReference,
  handlePaystackChargeSuccess,
  initializePaystackTransaction,
  isPaystackConfigured,
  verifyPaystackTransaction,
} from '@/lib/payments/paystack'

export type PaymentActionResult =
  | { success: true; data: { authorizationUrl: string } }
  | { success: false; error: string }

async function loadInvoiceForPayment(invoiceId: string, hotelId: string) {
  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, guest_id, guest_name, total_amount, payment_status, hotel_id')
    .eq('id', invoiceId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  return invoice
}

function resolvePayerEmail(
  guestEmail: string | null | undefined,
  fallbackName: string,
): string {
  const trimmed = guestEmail?.trim()
  if (trimmed && trimmed.includes('@')) return trimmed
  const slug = fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
  return `${slug || 'guest'}@guest.mojo.local`
}

export async function initiateStaffInvoicePayment(
  invoiceId: string,
): Promise<PaymentActionResult> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'owner') {
    return { success: false, error: 'Not authorized.' }
  }

  if (!isPaystackConfigured()) {
    return { success: false, error: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY.' }
  }

  const invoice = await loadInvoiceForPayment(invoiceId, profile.hotel_id)
  if (!invoice) return { success: false, error: 'Invoice not found.' }
  if (invoice.payment_status === 'paid') {
    return { success: false, error: 'Invoice is already paid.' }
  }

  const amount = Number(invoice.total_amount ?? 0)
  if (amount <= 0) return { success: false, error: 'Invalid invoice amount.' }

  let guestEmail: string | null = null
  if (invoice.guest_id) {
    const admin = createAdminClient()
    const { data: guest } = await admin
      .from('guests')
      .select('email')
      .eq('id', invoice.guest_id)
      .maybeSingle()
    guestEmail = guest?.email ?? null
  }

  const reference = buildPaystackReference(invoiceId)
  const result = await initializePaystackTransaction({
    email: resolvePayerEmail(guestEmail, invoice.guest_name),
    amountGhs: amount,
    reference,
    metadata: {
      invoice_id: invoiceId,
      hotel_id: profile.hotel_id,
      guest_id: invoice.guest_id,
    },
    callbackPath: '/owner/billing/payment/callback',
  })

  if ('error' in result) return { success: false, error: result.error }
  return { success: true, data: { authorizationUrl: result.authorizationUrl } }
}

export async function initiateGuestInvoicePayment(
  invoiceId: string,
): Promise<PaymentActionResult> {
  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return { success: false, error: session.success ? 'Sign in to the guest portal first.' : session.error }
  }

  const guest = session.data.guest

  if (!isPaystackConfigured()) {
    return { success: false, error: 'Online payments are not available yet.' }
  }

  const supabase = await createClient()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, guest_id, guest_name, total_amount, payment_status, hotel_id')
    .eq('id', invoiceId)
    .eq('guest_id', guest.id)
    .maybeSingle()

  if (!invoice) return { success: false, error: 'Invoice not found.' }
  if (invoice.payment_status === 'paid') {
    return { success: false, error: 'This invoice is already paid.' }
  }
  if (invoice.payment_status === 'refunded') {
    return { success: false, error: 'This invoice has been refunded.' }
  }

  const amount = Number(invoice.total_amount ?? 0)
  if (amount <= 0) return { success: false, error: 'Invalid invoice amount.' }

  const reference = buildPaystackReference(invoiceId)
  const result = await initializePaystackTransaction({
    email: resolvePayerEmail(guest.email, invoice.guest_name),
    amountGhs: amount,
    reference,
    metadata: {
      invoice_id: invoiceId,
      hotel_id: invoice.hotel_id,
      guest_id: guest.id,
    },
    callbackPath: '/guest/payment/callback',
  })

  if ('error' in result) return { success: false, error: result.error }
  return { success: true, data: { authorizationUrl: result.authorizationUrl } }
}

export async function confirmPaystackPayment(reference: string): Promise<{
  ok: boolean
  error?: string
}> {
  if (!reference.trim()) return { ok: false, error: 'Missing payment reference.' }

  const verified = await verifyPaystackTransaction(reference.trim())
  if (!verified.ok) return { ok: false, error: verified.error }

  const result = await handlePaystackChargeSuccess({
    reference: verified.data.reference,
    amount: verified.data.amount,
    currency: verified.data.currency,
    metadata: verified.data.metadata,
  })

  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export async function verifyAndRedirectStaffPayment(reference: string): Promise<void> {
  const result = await confirmPaystackPayment(reference)
  if (result.ok) {
    redirect('/owner/billing?paid=1')
  }
  redirect(`/owner/billing?payment_error=${encodeURIComponent(result.error ?? 'Payment failed')}`)
}

export async function verifyAndRedirectGuestPayment(reference: string): Promise<void> {
  const result = await confirmPaystackPayment(reference)
  if (result.ok) {
    redirect('/guest/portal?paid=1')
  }
  redirect(`/guest/portal?payment_error=${encodeURIComponent(result.error ?? 'Payment failed')}`)
}
