import { describe, expect, it } from 'vitest'
import { computeInvoiceTaxes, GRA_GROSS_MULTIPLIER } from '@/lib/tax'

describe('computeInvoiceTaxes', () => {
  it('adds taxes on exclusive subtotal', () => {
    const taxes = computeInvoiceTaxes(1000, 'exclusive')
    expect(taxes.subtotal).toBe(1000)
    expect(taxes.total).toBe(Math.round(1000 * GRA_GROSS_MULTIPLIER * 100) / 100)
    expect(taxes.total).toBeGreaterThan(taxes.subtotal)
  })

  it('extracts taxes from inclusive gross total', () => {
    const gross = 1219
    const taxes = computeInvoiceTaxes(gross, 'inclusive')
    expect(taxes.total).toBe(gross)
    expect(taxes.subtotal).toBeLessThan(gross)
    expect(taxes.vat).toBeGreaterThan(0)
  })

  it('rounds inclusive base so components sum to gross', () => {
    const gross = 500
    const taxes = computeInvoiceTaxes(gross, 'inclusive')
    const sum = Math.round(
      (taxes.subtotal + taxes.nhil + taxes.getfund + taxes.covid + taxes.vat + taxes.elevy) * 100,
    ) / 100
    expect(sum).toBe(gross)
  })
})
