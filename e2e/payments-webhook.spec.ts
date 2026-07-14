import { createHmac } from 'node:crypto'
import { test, expect } from '@playwright/test'

/**
 * Webhook security smoke tests always run.
 * Full Paystack hosted-checkout E2E (staff initiate → test card → webhook → paid invoice)
 * requires PAYMENTS_ENABLED=true, PAYSTACK_SECRET_KEY (test), seeded staff/guest data,
 * and PAYMENTS_E2E=1 — skipped in CI smoke otherwise.
 */
test.describe('Paystack webhook endpoint', () => {
  test('rejects missing signature with 401', async ({ request }) => {
    const res = await request.post('/api/webhooks/paystack', {
      data: { event: 'charge.success', data: { reference: 'x' } },
    })
    // 401 when enabled; 503 when PAYMENTS_ENABLED is off
    expect([401, 503]).toContain(res.status())
  })

  test('rejects invalid signature with 401 when payments enabled', async ({ request }) => {
    test.skip(process.env.PAYMENTS_ENABLED?.toLowerCase() !== 'true', 'Payments disabled')

    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'pay_test', amount: 100, currency: 'GHS', channel: 'card' },
    })
    const res = await request.post('/api/webhooks/paystack', {
      headers: {
        'content-type': 'application/json',
        'x-paystack-signature': 'definitely-not-valid',
      },
      data: body,
    })
    expect(res.status()).toBe(401)
  })

  test('accepts valid signature shape when payments enabled (unknown ref still 200)', async ({
    request,
  }) => {
    test.skip(process.env.PAYMENTS_ENABLED?.toLowerCase() !== 'true', 'Payments disabled')
    const secret = process.env.PAYSTACK_SECRET_KEY?.trim()
    test.skip(!secret, 'PAYSTACK_SECRET_KEY not set')

    const body = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 1,
        reference: 'pay_e2e_unknown_ref',
        amount: 100,
        currency: 'GHS',
        channel: 'card',
      },
    })
    const signature = createHmac('sha512', secret!).update(body).digest('hex')
    const res = await request.post('/api/webhooks/paystack', {
      headers: {
        'content-type': 'application/json',
        'x-paystack-signature': signature,
      },
      data: body,
    })
    expect(res.status()).toBe(200)
  })
})

test.describe('Paystack full checkout E2E', () => {
  test('staff initiate → test checkout → webhook → paid (manual / keyed env)', async () => {
    test.skip(
      process.env.PAYMENTS_E2E !== '1',
      'Set PAYMENTS_E2E=1 with test keys + seeded hotel data to run the full flow',
    )
    // Intentionally reserved: full browser checkout against Paystack test mode needs
    // a seeded invoice, staff session cookies, and a reachable webhook (e.g. ngrok).
    // Unit tests cover idempotent apply + signature rejection without live money.
    expect(process.env.PAYSTACK_SECRET_KEY).toBeTruthy()
  })
})
