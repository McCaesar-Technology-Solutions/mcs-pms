import { NextResponse } from 'next/server'
import { handlePaystackChargeSuccess, verifyPaystackSignature } from '@/lib/payments/paystack'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: {
    event?: string
    data?: {
      reference: string
      amount: number
      currency: string
      metadata?: { invoice_id?: string; hotel_id?: string; guest_id?: string }
    }
  }

  try {
    payload = JSON.parse(rawBody) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.event === 'charge.success' && payload.data) {
    const result = await handlePaystackChargeSuccess(payload.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }
  }

  return NextResponse.json({ received: true })
}
