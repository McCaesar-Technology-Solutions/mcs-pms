import { describe, expect, it } from 'vitest'
import {
  assertCheckInPaymentMet,
  requiredPaymentAtCheckIn,
} from '@/lib/billing/check-in-payment-policy'
import {
  requiresDepositDisposition,
  validateDepositDispositionInput,
} from '@/lib/billing/deposit-disposition'
import { mergeCollectedAmount } from '@/lib/billing/invoice-ledger'
import {
  buildCheckoutInvoicePaymentState,
  reservationBalanceDue,
} from '@/lib/billing/reservation-payment'
import { computeHotelOutstandingBalance } from '@/lib/billing/outstanding-balance'
import { validateCheckoutBalance } from '@/lib/reservations/checkout-validation'
import type { DbInvoice, Reservation } from '@/types'

/**
 * Phase 6 rollout verification — maps to docs/GO-LIVE.md partial-payments checklist.
 */
describe('partial payments rollout verification', () => {
  const stayTotal = 1000
  const policy = { mode: 'percent' as const, value: 50, nights: 2, nightlyRate: 500 }

  it('30% online + 20% at desk → partial status and correct outstanding', () => {
    const afterOnline = 300
    const afterDesk = afterOnline + 200

    expect(reservationBalanceDue(stayTotal, afterOnline)).toBe(700)
    expect(reservationBalanceDue(stayTotal, afterDesk)).toBe(500)

    const reservation = {
      id: 'r1',
      status: 'checked_in',
      balanceDue: 500,
      paymentStatus: 'partial',
      paidAmount: afterDesk,
    } as Reservation

    const invoices: DbInvoice[] = [
      {
        id: 'i1',
        reservation_id: 'r1',
        total_amount: stayTotal,
        amount_paid: afterDesk,
        payment_status: 'partial',
      } as DbInvoice,
    ]

    const summary = computeHotelOutstandingBalance([reservation], invoices)
    expect(summary.total).toBe(500)
    expect(summary.reservationCount).toBe(1)
  })

  it('walk-in meets check-in minimum → check-in allowed', () => {
    const required = requiredPaymentAtCheckIn({
      invoiceTotal: stayTotal,
      mode: policy.mode,
      value: policy.value,
      nights: policy.nights,
      nightlyRate: policy.nightlyRate,
    })
    expect(required).toBe(500)

    const blocked = assertCheckInPaymentMet({
      ...policy,
      invoiceTotal: stayTotal,
      amountPaid: 400,
    })
    expect(blocked.ok).toBe(false)

    const allowed = assertCheckInPaymentMet({
      ...policy,
      invoiceTotal: stayTotal,
      amountPaid: 500,
    })
    expect(allowed.ok).toBe(true)
  })

  it('folio refresh after partial pay preserves prior collections', () => {
    const priorPaid = 300
    const refreshedTotal = 750

    const collected = mergeCollectedAmount(priorPaid, priorPaid, priorPaid)
    expect(collected).toBe(300)

    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: refreshedTotal,
      priorDeposit: collected,
      paidNow: false,
    })
    expect(state.amountPaid).toBe(300)
    expect(state.paymentStatus).toBe('partial')
    expect(reservationBalanceDue(refreshedTotal, state.amountPaid)).toBe(450)
  })

  it('checkout at ₵0 balance → release room', () => {
    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        amountPaid: 600,
      }).ok,
    ).toBe(true)

    expect(
      validateCheckoutBalance({
        invoiceTotal: 600,
        amountPaid: 200,
      }).ok,
    ).toBe(false)
  })

  it('cancel with money collected → deposit disposition required', () => {
    expect(requiresDepositDisposition(150)).toBe(true)
    expect(validateDepositDispositionInput(150, undefined, 'receptionist').ok).toBe(false)
    expect(validateDepositDispositionInput(150, 'forfeit', 'receptionist').ok).toBe(true)
    expect(validateDepositDispositionInput(150, 'refund', 'receptionist').ok).toBe(false)
    expect(validateDepositDispositionInput(150, 'refund', 'owner').ok).toBe(true)
  })
})
