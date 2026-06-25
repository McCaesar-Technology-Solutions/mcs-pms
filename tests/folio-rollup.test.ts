import { describe, expect, it } from 'vitest'
import { mergeRoomTaxesWithFolio, sumFolioSubtotal } from '@/lib/folio/rollup'
import { deriveInvoicePaymentStatus, invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import { computeInvoiceTaxes } from '@/lib/tax'

describe('mergeRoomTaxesWithFolio', () => {
  it('returns room taxes unchanged when no folio charges', () => {
    const room = computeInvoiceTaxes(1000, 'exclusive')
    expect(mergeRoomTaxesWithFolio(room, 0)).toEqual(room)
  })

  it('adds folio subtotal with GRA taxes on checkout', () => {
    const room = computeInvoiceTaxes(1000, 'exclusive')
    const merged = mergeRoomTaxesWithFolio(room, 200)
    expect(merged.subtotal).toBeGreaterThan(room.subtotal)
    expect(merged.total).toBeGreaterThan(room.total)
  })
})

describe('sumFolioSubtotal', () => {
  it('sums charge amounts', () => {
    expect(
      sumFolioSubtotal([
        { id: '1', amount: 50, description: 'Minibar', charge_type: 'incidental' },
        { id: '2', amount: 25.5, description: 'Laundry', charge_type: 'incidental' },
      ]),
    ).toBe(75.5)
  })
})

describe('deriveInvoicePaymentStatus', () => {
  it('marks partial when some amount paid', () => {
    expect(deriveInvoicePaymentStatus(100, 40)).toBe('partial')
  })

  it('marks paid when fully settled', () => {
    expect(deriveInvoicePaymentStatus(100, 100)).toBe('paid')
    expect(deriveInvoicePaymentStatus(100, 100.001)).toBe('paid')
  })

  it('preserves refunded status', () => {
    expect(deriveInvoicePaymentStatus(100, 0, 'refunded')).toBe('refunded')
  })
})

describe('invoiceBalanceDue', () => {
  it('returns remaining balance', () => {
    expect(invoiceBalanceDue(250, 100)).toBe(150)
    expect(invoiceBalanceDue(250, 300)).toBe(0)
  })
})
