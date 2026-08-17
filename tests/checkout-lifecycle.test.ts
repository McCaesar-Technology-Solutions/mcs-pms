import { describe, expect, it } from 'vitest'
import { mergeCollectedAmount } from '@/lib/billing/invoice-ledger'
import { validateCheckoutBalance } from '@/lib/reservations/checkout-validation'
import { buildCheckoutInvoicePaymentState } from '@/lib/billing/reservation-payment'

describe('mergeCollectedAmount', () => {
  it('uses the highest trusted collected amount', () => {
    expect(mergeCollectedAmount(200, 150, 180)).toBe(200)
    expect(mergeCollectedAmount(100, 150, 120)).toBe(150)
    expect(mergeCollectedAmount(50, 40, 250)).toBe(250)
  })
})

describe('validateCheckoutBalance', () => {
  it('rejects checkout when outstanding remains', () => {
    const result = validateCheckoutBalance({
      invoiceTotal: 600,
      amountPaid: 200,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('BALANCE_DUE')
  })

  it('allows checkout when fully settled', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        amountPaid: 600,
      }).ok,
    ).toBe(true)
  })

  it('allows zero-balance departure', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 0,
        amountPaid: 0,
      }).ok,
    ).toBe(true)
  })
})

describe('invoice refresh payment preservation', () => {
  it('preserves prior deposit when folio increases total', () => {
    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: 750,
      priorDeposit: 300,
      paidNow: false,
    })
    expect(state.amountPaid).toBe(300)
    expect(state.paymentStatus).toBe('partial')
  })

  it('caps collected at new total when stay shortens', () => {
    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: 400,
      priorDeposit: 500,
      paidNow: false,
    })
    expect(state.amountPaid).toBe(400)
    expect(state.paymentStatus).toBe('paid')
  })
})
