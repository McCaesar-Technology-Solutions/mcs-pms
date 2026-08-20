import { describe, expect, it } from 'vitest'
import {
  invoiceBalanceDue,
  shouldCollectAfterStayExtension,
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
})
