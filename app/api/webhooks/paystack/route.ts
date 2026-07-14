import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPaymentsEnabled } from '@/lib/payments/enabled'
import { getPaymentProvider } from '@/lib/payments/get-provider'
import { processPaystackWebhookEvent } from '@/lib/payments/process-webhook'

export const runtime = 'nodejs'

/**
 * Paystack webhook.
 * Authorization comes entirely from HMAC signature verification (not RLS / session).
 * Signature must be checked before any DB work. Use createAdminClient only after verify.
 */
export async function POST(request: Request) {
  if (!isPaymentsEnabled()) {
    return NextResponse.json({ error: 'Payments disabled' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signatureHeader = request.headers.get('x-paystack-signature') ?? ''

  const provider = getPaymentProvider('paystack')
  if (!provider.verifySignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = provider.parseWebhookEvent(rawBody)
  const admin = createAdminClient()
  const result = await processPaystackWebhookEvent(admin, event)

  if (!result.handled) {
    // Return 200 for unknown refs after signature verify to avoid Paystack retry storms
    // on stale/test events, but log for ops.
    console.error('[paystack-webhook]', result.error, event.reference)
  }

  return NextResponse.json({ ok: true })
}
