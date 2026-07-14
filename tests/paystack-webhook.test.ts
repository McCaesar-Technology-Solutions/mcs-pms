import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'sk_test_unit_secret'

vi.mock('@/lib/payments/enabled', () => ({
  isPaymentsEnabled: () => true,
  getPaystackSecretKey: () => SECRET,
}))

const writeAuditLog = vi.fn()
vi.mock('@/lib/audit/log', () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}))

const enqueueEmailOutbox = vi.fn()
const enqueueSmsOutbox = vi.fn()
vi.mock('@/lib/notifications/outbox', () => ({
  enqueueEmailOutbox: (...args: unknown[]) => enqueueEmailOutbox(...args),
  enqueueSmsOutbox: (...args: unknown[]) => enqueueSmsOutbox(...args),
}))

vi.mock('@/lib/notifications/app-url', () => ({
  appUrl: (path: string) => `https://example.com${path}`,
}))

const applyInvoicePaymentRecord = vi.fn()
vi.mock('@/lib/billing/apply-payment', () => ({
  applyInvoicePaymentRecord: (...args: unknown[]) => applyInvoicePaymentRecord(...args),
}))

import { createPaystackProvider } from '@/lib/payments/paystack'
import { processPaystackWebhookEvent } from '@/lib/payments/process-webhook'
import { POST as paystackWebhookPost } from '@/app/api/webhooks/paystack/route'

const HOTEL_ID = '11111111-1111-4111-8111-111111111111'
const PAYMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const INVOICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const GUEST_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const REFERENCE = 'pay_11111111_ref-1'

function sign(body: string) {
  return createHmac('sha512', SECRET).update(body).digest('hex')
}

function chargeSuccessBody(reference = REFERENCE) {
  return JSON.stringify({
    event: 'charge.success',
    data: {
      id: 998877,
      reference,
      amount: 15000,
      currency: 'GHS',
      channel: 'mobile_money',
    },
  })
}

function createAdminMock(overrides?: {
  paymentStatus?: string
  updateAffected?: number
}) {
  const payment = {
    id: PAYMENT_ID,
    hotel_id: HOTEL_ID,
    guest_id: GUEST_ID,
    invoice_id: INVOICE_ID,
    reservation_id: null,
    amount: 150,
    status: overrides?.paymentStatus ?? 'pending',
    provider_reference: REFERENCE,
    initiated_by: null,
  }

  const updateSelect = vi.fn().mockResolvedValue({
    data: (overrides?.updateAffected ?? 1) > 0 ? [{ id: PAYMENT_ID }] : [],
    error: null,
  })
  const updateEqStatus = vi.fn(() => ({ select: updateSelect }))
  const updateEqId = vi.fn(() => ({ eq: updateEqStatus }))
  const update = vi.fn(() => ({ eq: updateEqId }))

  const paymentsMaybeSingle = vi.fn().mockResolvedValue({ data: payment, error: null })
  const paymentsEqRef = vi.fn(() => ({ maybeSingle: paymentsMaybeSingle }))
  const paymentsSelect = vi.fn(() => ({ eq: paymentsEqRef }))

  const guestsMaybeSingle = vi.fn().mockResolvedValue({
    data: { name: 'Ama', email: 'ama@example.com', phone: '+233201234567' },
    error: null,
  })
  const guestsEqHotel = vi.fn(() => ({ maybeSingle: guestsMaybeSingle }))
  const guestsEqId = vi.fn(() => ({ eq: guestsEqHotel }))
  const guestsSelect = vi.fn(() => ({ eq: guestsEqId }))

  const invoicesMaybeSingle = vi.fn().mockResolvedValue({
    data: { invoice_number: 'INV-1' },
    error: null,
  })
  const invoicesEqHotel = vi.fn(() => ({ maybeSingle: invoicesMaybeSingle }))
  const invoicesEqId = vi.fn(() => ({ eq: invoicesEqHotel }))
  const invoicesSelect = vi.fn(() => ({ eq: invoicesEqId }))

  const from = vi.fn((table: string) => {
    if (table === 'payments') {
      return { select: paymentsSelect, update }
    }
    if (table === 'guests') {
      return { select: guestsSelect }
    }
    if (table === 'invoices') {
      return { select: invoicesSelect }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return {
    from,
    _update: update,
    _updateSelect: updateSelect,
  }
}

describe('Paystack signature verification', () => {
  it('accepts a valid HMAC-SHA512 signature', () => {
    const provider = createPaystackProvider()
    const body = chargeSuccessBody()
    expect(provider.verifySignature(body, sign(body))).toBe(true)
  })

  it('rejects wrong, missing, and malformed signatures', () => {
    const provider = createPaystackProvider()
    const body = chargeSuccessBody()
    expect(provider.verifySignature(body, 'not-valid')).toBe(false)
    expect(provider.verifySignature(body, '')).toBe(false)
    expect(provider.verifySignature(body, sign(body + 'x'))).toBe(false)
  })
})

describe('processPaystackWebhookEvent idempotency', () => {
  beforeEach(() => {
    writeAuditLog.mockReset()
    enqueueEmailOutbox.mockReset()
    enqueueSmsOutbox.mockReset()
    applyInvoicePaymentRecord.mockReset()
    applyInvoicePaymentRecord.mockResolvedValue({ ok: true })
    enqueueEmailOutbox.mockResolvedValue(undefined)
    enqueueSmsOutbox.mockResolvedValue(undefined)
  })

  it('applies charge.success once and no-ops on the second call', async () => {
    const firstAdmin = createAdminMock({ paymentStatus: 'pending', updateAffected: 1 })
    const provider = createPaystackProvider()
    const event = provider.parseWebhookEvent(chargeSuccessBody())

    const first = await processPaystackWebhookEvent(firstAdmin as never, event)
    expect(first).toEqual({ handled: true, reason: 'applied' })
    expect(applyInvoicePaymentRecord).toHaveBeenCalledTimes(1)
    expect(writeAuditLog).toHaveBeenCalledTimes(1)

    // Allow async receipt enqueue to settle
    await Promise.resolve()
    await Promise.resolve()
    expect(enqueueEmailOutbox).toHaveBeenCalledTimes(1)
    expect(enqueueSmsOutbox).toHaveBeenCalledTimes(1)

    writeAuditLog.mockClear()
    enqueueEmailOutbox.mockClear()
    enqueueSmsOutbox.mockClear()
    applyInvoicePaymentRecord.mockClear()

    const secondAdmin = createAdminMock({ paymentStatus: 'success', updateAffected: 0 })
    const second = await processPaystackWebhookEvent(secondAdmin as never, event)
    expect(second).toEqual({ handled: true, reason: 'already_terminal' })
    expect(applyInvoicePaymentRecord).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
    expect(enqueueEmailOutbox).not.toHaveBeenCalled()
    expect(enqueueSmsOutbox).not.toHaveBeenCalled()
  })

  it('no-ops when concurrent update loses the pending race', async () => {
    const admin = createAdminMock({ paymentStatus: 'pending', updateAffected: 0 })
    const provider = createPaystackProvider()
    const event = provider.parseWebhookEvent(chargeSuccessBody())

    const result = await processPaystackWebhookEvent(admin as never, event)
    expect(result).toEqual({ handled: true, reason: 'already_terminal' })
    expect(applyInvoicePaymentRecord).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })
})

describe('Paystack webhook route', () => {
  it('returns 401 when signature is wrong', async () => {
    const body = chargeSuccessBody()
    const res = await paystackWebhookPost(
      new Request('http://localhost/api/webhooks/paystack', {
        method: 'POST',
        headers: { 'x-paystack-signature': 'bad-signature' },
        body,
      }),
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/signature/i)
  })
})
