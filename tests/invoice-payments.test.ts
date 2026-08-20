import { describe, expect, it } from 'vitest'
import {
  invoiceBalanceDue,
  shouldCollectAfterStayExtension,
  stayCreditAfterShorten,
} from '@/lib/billing/invoice-payments'

describe('shouldCollectAfterStayExtension', () => {
  it('opens collect when extra nights leave a balance', () => {
    expect(
      shouldCollectAfterStayExtension({
        invoiceId: 'inv-1',
        balanceDue: 200,
      }),
    ).toBe(true)
  })

  it('skips collect when the stay is already paid', () => {
    expect(
      shouldCollectAfterStayExtension({
        invoiceId: 'inv-1',
        balanceDue: 0,
      }),
    ).toBe(false)
  })

  it('skips collect when invoice refresh failed', () => {
    expect(
      shouldCollectAfterStayExtension({
        invoiceId: 'inv-1',
        balanceDue: 200,
        invoiceError: 'Could not refresh stay invoice.',
      }),
    ).toBe(false)
  })

  it('skips collect when no invoice exists', () => {
    expect(
      shouldCollectAfterStayExtension({
        invoiceId: null,
        balanceDue: 200,
      }),
    ).toBe(false)
  })
})

describe('invoiceBalanceDue', () => {
  it('rounds remaining extra nights', () => {
    expect(invoiceBalanceDue(1210.55, 200)).toBe(1010.55)
  })

  it('treats overpayment as zero due', () => {
    expect(invoiceBalanceDue(400, 500)).toBe(0)
  })
})

describe('stayCreditAfterShorten', () => {
  it('keeps extra collected as credit when nights come off', () => {
    expect(stayCreditAfterShorten(400, 500)).toBe(100)
  })

  it('is zero when the new total is still unpaid or even', () => {
    expect(stayCreditAfterShorten(400, 400)).toBe(0)
    expect(stayCreditAfterShorten(400, 200)).toBe(0)
  })
})
