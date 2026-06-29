import { describe, expect, it } from 'vitest'
import { validateCheckoutBalance } from '@/lib/reservations/checkout-validation'

describe('validateCheckoutBalance', () => {
  it('allows pay-later when outstanding remains', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        priorDeposit: 200,
        markAsPaid: false,
      }).ok,
    ).toBe(true)
  })

  it('blocks marking paid when deposit does not cover total', () => {
    const result = validateCheckoutBalance({
      invoiceTotal: 600,
      priorDeposit: 200,
      markAsPaid: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('OUTSTANDING_BALANCE')
    }
  })

  it('allows full payment when deposit covers total', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        priorDeposit: 600,
        markAsPaid: true,
      }).ok,
    ).toBe(true)
  })
})
