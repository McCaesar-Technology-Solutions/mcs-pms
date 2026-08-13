import { describe, expect, it } from 'vitest'
import { validateCheckoutBalance } from '@/lib/reservations/checkout-validation'

describe('validateCheckoutBalance', () => {
  it('rejects unpaid checkout when outstanding remains', () => {
    const result = validateCheckoutBalance({
      invoiceTotal: 600,
      priorDeposit: 200,
      markAsPaid: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('BALANCE_DUE')
    }
  })

  it('allows payment received now when deposit does not cover total', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        priorDeposit: 200,
        markAsPaid: true,
      }).ok,
    ).toBe(true)
  })

  it('allows checkout when deposit covers total even if markAsPaid is false', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        priorDeposit: 600,
        markAsPaid: false,
      }).ok,
    ).toBe(true)
  })

  it('allows zero-balance departure without collecting again', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 450,
        priorDeposit: 450,
        markAsPaid: false,
      }).ok,
    ).toBe(true)
  })
})
