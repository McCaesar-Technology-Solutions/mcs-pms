import { describe, expect, it } from 'vitest'
import {
  computeInvoiceTaxes,
  defaultHotelTaxRates,
  GRA_GROSS_MULTIPLIER,
  graGrossMultiplier,
  resolveHotelTaxRates,
  resolveInvoiceTaxRates,
  taxSnapshotFromRates,
} from '@/lib/tax'

describe('computeInvoiceTaxes', () => {
  it('adds taxes on exclusive subtotal', () => {
    const taxes = computeInvoiceTaxes(1000, 'exclusive')
    expect(taxes.subtotal).toBe(1000)
    expect(taxes.total).toBe(Math.round(1000 * GRA_GROSS_MULTIPLIER * 100) / 100)
    expect(taxes.total).toBeGreaterThan(taxes.subtotal)
    expect(taxes.tourism).toBe(0)
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
    const sum =
      Math.round(
        (taxes.subtotal +
          taxes.nhil +
          taxes.getfund +
          taxes.covid +
          taxes.vat +
          taxes.elevy +
          taxes.tourism) *
          100,
      ) / 100
    expect(sum).toBe(gross)
  })

  it('applies custom hotel rates', () => {
    const rates = {
      ...defaultHotelTaxRates(),
      elevy: 0.01,
      vat: 0.125,
    }
    const taxes = computeInvoiceTaxes(1000, 'exclusive', rates)
    expect(taxes.elevy).toBe(10)
    expect(taxes.vat).toBe(
      Math.round((1000 + taxes.nhil + taxes.getfund + taxes.covid) * 0.125 * 100) / 100,
    )
    expect(taxes.total).toBe(Math.round(1000 * graGrossMultiplier(rates) * 100) / 100)
  })

  it('adds tourism levy outside the NHIL/GETFund/VAT base', () => {
    const base = defaultHotelTaxRates()
    const withTourism = { ...base, tourism: 0.01 }
    const plain = computeInvoiceTaxes(1000, 'exclusive', base)
    const taxed = computeInvoiceTaxes(1000, 'exclusive', withTourism)

    expect(taxed.tourism).toBe(10)
    expect(taxed.nhil).toBe(plain.nhil)
    expect(taxed.getfund).toBe(plain.getfund)
    expect(taxed.covid).toBe(plain.covid)
    expect(taxed.vat).toBe(plain.vat)
    expect(taxed.total).toBe(Math.round((plain.total + 10) * 100) / 100)
  })
})

describe('resolveHotelTaxRates', () => {
  it('uses system defaults when hotel rates are null', () => {
    const rates = resolveHotelTaxRates({
      tax_nhil_rate: null,
      tax_getfund_rate: null,
      tax_vat_rate: null,
      tax_elevy_rate: null,
      tax_covid_rate: null,
      tax_tourism_levy_rate: null,
    })
    expect(rates).toEqual(defaultHotelTaxRates())
    expect(rates.tourism).toBe(0)
  })

  it('applies overrides when set', () => {
    const rates = resolveHotelTaxRates({
      tax_nhil_rate: 0.03,
      tax_tourism_levy_rate: 0.01,
    })
    expect(rates.nhil).toBe(0.03)
    expect(rates.tourism).toBe(0.01)
    expect(rates.vat).toBe(defaultHotelTaxRates().vat)
  })
})

describe('resolveInvoiceTaxRates', () => {
  it('freezes rates from an existing invoice snapshot', () => {
    const hotel = { ...defaultHotelTaxRates(), tourism: 0.01, elevy: 0.01 }
    const issued = taxSnapshotFromRates(defaultHotelTaxRates())
    const resolved = resolveInvoiceTaxRates(issued, hotel)
    expect(resolved.frozen).toBe(true)
    expect(resolved.rates.tourism).toBe(0)
    expect(resolved.rates.elevy).toBe(0)
  })

  it('uses hotel rates on first issue', () => {
    const hotel = { ...defaultHotelTaxRates(), tourism: 0.01 }
    const resolved = resolveInvoiceTaxRates(null, hotel)
    expect(resolved.frozen).toBe(false)
    expect(resolved.rates.tourism).toBe(0.01)
    expect(resolved.snapshot.tourism).toBe(0.01)
  })
})
