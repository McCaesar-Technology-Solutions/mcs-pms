import { describe, expect, it } from 'vitest'
import { paystackChannelToPaymentMethod } from '@/lib/payments/channel-to-method'
import { ghsToPesewas, pesewasToGhs } from '@/lib/payments/paystack'

describe('paystack channel mapping', () => {
  it('maps MoMo and card channels', () => {
    expect(paystackChannelToPaymentMethod('mobile_money')).toBe('mtn_momo')
    expect(paystackChannelToPaymentMethod('mobile_money', 'telecel')).toBe('telecel_cash')
    expect(paystackChannelToPaymentMethod('card', 'mastercard')).toBe('mastercard')
    expect(paystackChannelToPaymentMethod('card', 'visa')).toBe('visa')
    expect(paystackChannelToPaymentMethod('bank_transfer')).toBe('bank_transfer')
  })
})

describe('GHS pesewas conversion', () => {
  it('round-trips common amounts', () => {
    expect(ghsToPesewas(150)).toBe(15000)
    expect(pesewasToGhs(15000)).toBe(150)
    expect(ghsToPesewas(12.34)).toBe(1234)
  })
})
