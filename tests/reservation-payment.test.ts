import { describe, expect, it } from 'vitest'
import {
  buildCheckoutInvoicePaymentState,
  derivePreCheckoutPaymentStatus,
  reservationBalanceDue,
} from '@/lib/billing/reservation-payment'

describe('reservation payment', () => {
  it('derives pre-checkout payment status', () => {
    expect(derivePreCheckoutPaymentStatus(500, 0)).toBe('unpaid')
    expect(derivePreCheckoutPaymentStatus(500, 100)).toBe('deposit_paid')
    expect(derivePreCheckoutPaymentStatus(500, 500)).toBe('paid')
    expect(derivePreCheckoutPaymentStatus(0, 0)).toBe('complimentary')
  })

  it('computes balance due', () => {
    expect(reservationBalanceDue(500, 150)).toBe(350)
    expect(reservationBalanceDue(500, 600)).toBe(0)
  })

  it('applies deposit at checkout when not marking paid', () => {
    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: 600,
      priorDeposit: 200,
      paidNow: false,
    })
    expect(state.amountPaid).toBe(200)
    expect(state.paymentStatus).toBe('partial')
  })

  it('marks checkout paid in full', () => {
    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: 600,
      priorDeposit: 200,
      paidNow: true,
    })
    expect(state.amountPaid).toBe(600)
    expect(state.paymentStatus).toBe('paid')
  })
})
