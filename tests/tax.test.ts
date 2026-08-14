import { describe, expect, it } from 'vitest'
import {
  computeInvoiceTaxes,
  defaultHotelTaxRates,
  GRA_GROSS_MULTIPLIER,
  graGrossMultiplier,
  parseVatBase,
  resolveHotelTaxRates,
  resolveInvoiceTaxRates,
  taxSnapshotFromRates,
} from '@/lib/tax'

describe('computeInvoiceTaxes', () => {
  it('charges VAT on the stay amount like NHIL and GETFund', () => {
    const taxes = computeInvoiceTaxes(1000, 'exclusive')
    expect(taxes.subtotal).toBe(1000)
    expect(taxes.nhil).toBe(25)
    expect(taxes.getfund).toBe(25)
    expect(taxes.covid).toBe(0)
    expect(taxes.vat).toBe(150)
    expect(taxes.tourism).toBe(10)
    expect(taxes.total).toBe(1210)
    expect(taxes.total).toBe(Math.round(1000 * GRA_GROSS_MULTIPLIER * 100) / 100)
  })

  it('keeps stacked VAT when vat_base is stacked', () => {
    const taxes = computeInvoiceTaxes(1000, 'exclusive', defaultHotelTaxRates(), 'stacked')
    expect(taxes.nhil).toBe(25)
    expect(taxes.getfund).toBe(25)
    expect(taxes.vat).toBe(157.5)
    expect(taxes.tourism).toBe(10)
    expect(taxes.total).toBe(1217.5)
  })

  it('extracts taxes from inclusive gross total', () => {
    const gross = 1210
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

  it('applies custom hotel rates on the stay amount', () => {
    const rates = {
      ...defaultHotelTaxRates(),
      elevy: 0.01,
      vat: 0.125,
    }
    const taxes = computeInvoiceTaxes(1000, 'exclusive', rates)
    expect(taxes.elevy).toBe(10)
    expect(taxes.covid).toBe(0)
    expect(taxes.vat).toBe(125)
    expect(taxes.total).toBe(Math.round(1000 * graGrossMultiplier(rates) * 100) / 100)
  })

  it('adds tourism levy outside the VAT/NHIL/GETFund amounts', () => {
    const base = { ...defaultHotelTaxRates(), tourism: 0 }
    const withTourism = { ...base, tourism: 0.01 }
    const plain = computeInvoiceTaxes(1000, 'exclusive', base)
    const taxed = computeInvoiceTaxes(1000, 'exclusive', withTourism)

    expect(taxed.tourism).toBe(10)
    expect(taxed.nhil).toBe(plain.nhil)
    expect(taxed.getfund).toBe(plain.getfund)
    expect(taxed.covid).toBe(0)
    expect(taxed.vat).toBe(plain.vat)
    expect(taxed.total).toBe(Math.round((plain.total + 10) * 100) / 100)
  })

  it('ignores hotel COVID overrides on new invoices', () => {
    const rates = resolveHotelTaxRates({ tax_covid_rate: 0.01, tax_tourism_levy_rate: null })
    expect(rates.covid).toBe(0)
    expect(rates.tourism).toBe(0.01)
  })
})

describe('parseVatBase', () => {
  it('defaults new invoices to stay-base VAT', () => {
    expect(parseVatBase(null)).toBe('stay')
    expect(parseVatBase(undefined)).toBe('stay')
  })

  it('treats a rate snapshot without vat_base as stacked (legacy)', () => {
    const legacy = {
      nhil: 0.025,
      getfund: 0.025,
      covid: 0,
      vat: 0.15,
      elevy: 0,
      tourism: 0.01,
    }
    expect(parseVatBase(legacy)).toBe('stacked')
  })

  it('honours an explicit vat_base', () => {
    expect(parseVatBase({ ...defaultHotelTaxRates(), vat_base: 'stay' })).toBe('stay')
    expect(parseVatBase({ ...defaultHotelTaxRates(), vat_base: 'stacked' })).toBe('stacked')
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
    expect(rates.covid).toBe(0)
    expect(rates.tourism).toBe(0.01)
  })

  it('applies overrides when set', () => {
    const rates = resolveHotelTaxRates({
      tax_nhil_rate: 0.03,
      tax_tourism_levy_rate: 0.02,
    })
    expect(rates.nhil).toBe(0.03)
    expect(rates.tourism).toBe(0.02)
    expect(rates.vat).toBe(defaultHotelTaxRates().vat)
  })
})

describe('resolveInvoiceTaxRates', () => {
  it('freezes rates and stacked VAT from a legacy snapshot', () => {
    const hotel = { ...defaultHotelTaxRates(), tourism: 0.02, elevy: 0.01 }
    const issued = {
      nhil: 0.025,
      getfund: 0.025,
      covid: 0,
      vat: 0.15,
      elevy: 0,
      tourism: 0,
    }
    const resolved = resolveInvoiceTaxRates(issued, hotel)
    expect(resolved.frozen).toBe(true)
    expect(resolved.vatBase).toBe('stacked')
    expect(resolved.rates.tourism).toBe(0)
    expect(resolved.rates.elevy).toBe(0)
    expect(resolved.snapshot.vat_base).toBe('stacked')
  })

  it('uses hotel rates and stay-base VAT on first issue', () => {
    const hotel = { ...defaultHotelTaxRates(), tourism: 0.02 }
    const resolved = resolveInvoiceTaxRates(null, hotel)
    expect(resolved.frozen).toBe(false)
    expect(resolved.vatBase).toBe('stay')
    expect(resolved.rates.tourism).toBe(0.02)
    expect(resolved.snapshot.tourism).toBe(0.02)
    expect(resolved.snapshot.vat_base).toBe('stay')
  })

  it('preserves stay-base VAT on a new-style snapshot', () => {
    const issued = taxSnapshotFromRates({ ...defaultHotelTaxRates(), tourism: 0 }, 'stay')
    const resolved = resolveInvoiceTaxRates(issued, defaultHotelTaxRates())
    expect(resolved.frozen).toBe(true)
    expect(resolved.vatBase).toBe('stay')
  })
})
