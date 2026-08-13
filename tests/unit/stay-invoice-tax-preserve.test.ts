import { describe, expect, it } from 'vitest'
import { resolveStayInvoiceIncludeTax } from '@/lib/billing/build-stay-invoice'

describe('resolveStayInvoiceIncludeTax', () => {
  it('defaults new invoices to untaxed', () => {
    expect(resolveStayInvoiceIncludeTax(undefined, null)).toBe(false)
    expect(resolveStayInvoiceIncludeTax(false, null)).toBe(false)
  })

  it('allows opting into tax on a new invoice', () => {
    expect(resolveStayInvoiceIncludeTax(true, null)).toBe(true)
  })

  it('keeps tax on when refreshing a taxed invoice even if caller passes false', () => {
    expect(
      resolveStayInvoiceIncludeTax(false, {
        guest_tax_id: 'GHA-728071939-8',
        vat_amount: 15,
      }),
    ).toBe(true)
  })

  it('keeps tax on when only levy amounts are present', () => {
    expect(
      resolveStayInvoiceIncludeTax(false, {
        nhil_amount: 2.5,
        vat_amount: 0,
      }),
    ).toBe(true)
  })

  it('allows upgrading an untaxed invoice to taxed', () => {
    expect(
      resolveStayInvoiceIncludeTax(true, {
        guest_tax_id: null,
        vat_amount: 0,
        nhil_amount: 0,
      }),
    ).toBe(true)
  })

  it('leaves an untaxed invoice untaxed when caller omits tax', () => {
    expect(
      resolveStayInvoiceIncludeTax(undefined, {
        guest_tax_id: null,
        vat_amount: 0,
      }),
    ).toBe(false)
  })
})
