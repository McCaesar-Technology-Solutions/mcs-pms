import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import {
  buildPaystackReference,
  isPaystackConfigured,
  verifyPaystackSignature,
} from '@/lib/payments/paystack'

describe('isPaystackConfigured', () => {
  it('returns false when secret is unset', () => {
    const prev = process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET_KEY
    expect(isPaystackConfigured()).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = prev
  })
})

describe('verifyPaystackSignature', () => {
  it('validates HMAC signature', () => {
    const secret = 'test-secret'
    const body = '{"event":"charge.success"}'
    const signature = crypto.createHmac('sha512', secret).update(body).digest('hex')
    const prev = process.env.PAYSTACK_SECRET_KEY
    process.env.PAYSTACK_SECRET_KEY = secret
    expect(verifyPaystackSignature(body, signature)).toBe(true)
    expect(verifyPaystackSignature(body, 'bad')).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = prev
  })
})

describe('buildPaystackReference', () => {
  it('includes invoice prefix', () => {
    const ref = buildPaystackReference('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(ref.startsWith('mojo_')).toBe(true)
  })
})
