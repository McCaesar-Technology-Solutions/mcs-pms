import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppOrigin } from '@/lib/env'
import { applyInvoicePaymentRecord } from '@/lib/billing/apply-payment'

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim())
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secret || !signature) return false
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}

function paystackSecret(): string {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured')
  return secret
}

export function buildPaystackReference(invoiceId: string): string {
  const suffix = crypto.randomBytes(4).toString('hex')
  return `mojo_${invoiceId.replace(/-/g, '').slice(0, 12)}_${suffix}`
}

export async function initializePaystackTransaction(input: {
  email: string
  amountGhs: number
  reference: string
  metadata: {
    invoice_id: string
    hotel_id: string
    guest_id?: string | null
  }
  callbackPath?: string
}): Promise<{ authorizationUrl: string; reference: string } | { error: string }> {
  if (!isPaystackConfigured()) {
    return { error: 'Online payments are not configured for this property.' }
  }

  const amountKobo = Math.round(input.amountGhs * 100)
  if (amountKobo < 100) {
    return { error: 'Payment amount is too small.' }
  }

  const callbackUrl = `${getAppOrigin()}${input.callbackPath ?? '/billing/payment/callback'}?reference=${encodeURIComponent(input.reference)}`

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: amountKobo,
      currency: 'GHS',
      reference: input.reference,
      callback_url: callbackUrl,
      metadata: input.metadata,
    }),
  })

  const payload = (await response.json()) as {
    status?: boolean
    message?: string
    data?: { authorization_url?: string; reference?: string }
  }

  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    return { error: payload.message ?? 'Could not start payment.' }
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference ?? input.reference,
  }
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<{ ok: true; data: PaystackVerifyData } | { ok: false; error: string }> {
  if (!isPaystackConfigured()) {
    return { ok: false, error: 'Paystack is not configured.' }
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${paystackSecret()}` },
    },
  )

  const payload = (await response.json()) as {
    status?: boolean
    message?: string
    data?: PaystackVerifyData
  }

  if (!response.ok || !payload.status || !payload.data) {
    return { ok: false, error: payload.message ?? 'Verification failed.' }
  }

  if (payload.data.status !== 'success') {
    return { ok: false, error: 'Payment was not successful.' }
  }

  return { ok: true, data: payload.data }
}

export interface PaystackVerifyData {
  reference: string
  amount: number
  currency: string
  status: string
  metadata?: { invoice_id?: string; hotel_id?: string; guest_id?: string }
}

export async function handlePaystackChargeSuccess(event: {
  reference: string
  amount: number
  currency: string
  metadata?: { invoice_id?: string; hotel_id?: string; guest_id?: string }
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()
  const invoiceId = event.metadata?.invoice_id
  const hotelId = event.metadata?.hotel_id

  if (!invoiceId || !hotelId) {
    return { ok: false, error: 'Missing invoice metadata' }
  }

  const idempotencyKey = `paystack:${event.reference}`
  const { data: existing } = await admin
    .from('payment_records')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing?.status === 'success') return { ok: true }

  const amountGhs = event.amount / 100

  const paymentResult = await applyInvoicePaymentRecord(admin, {
    invoiceId,
    hotelId,
    amount: amountGhs,
    paymentMethod: 'visa',
    provider: 'paystack',
    providerReference: event.reference,
    idempotencyKey,
  })

  if (!paymentResult.ok) {
    return { ok: false, error: paymentResult.error }
  }

  return { ok: true }
}
