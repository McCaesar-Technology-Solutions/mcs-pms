import { describe, expect, it } from 'vitest'
import {
  applyDiscountToBase,
  computeDiscountAmount,
  discountLabel,
  normalizeDiscountType,
} from '@/lib/billing/discount'
import { mergeRoomTaxesWithFolio } from '@/lib/folio/rollup'
import { computeInvoiceTaxes } from '@/lib/tax'

describe('guest stay discounts', () => {
  it('computes percent discount capped at 100%', () => {
    expect(computeDiscountAmount(1000, 'percent', 10)).toBe(100)
    expect(computeDiscountAmount(1000, 'percent', 150)).toBe(1000)
  })

  it('computes fixed discount capped at base', () => {
    expect(computeDiscountAmount(500, 'fixed', 75)).toBe(75)
    expect(computeDiscountAmount(50, 'fixed', 75)).toBe(50)
  })

  it('returns zero for none / empty', () => {
    expect(computeDiscountAmount(1000, 'none', 10)).toBe(0)
    expect(computeDiscountAmount(1000, null, 10)).toBe(0)
    expect(normalizeDiscountType('percent')).toBe('percent')
    expect(normalizeDiscountType('other')).toBe('none')
  })

  it('applies discount before tax so levies shrink', () => {
    const full = computeInvoiceTaxes(1000, 'exclusive')
    const { taxableBase, discountAmount } = applyDiscountToBase(1000, 'percent', 10)
    expect(discountAmount).toBe(100)
    expect(taxableBase).toBe(900)
    const discounted = computeInvoiceTaxes(taxableBase, 'exclusive')
    expect(discounted.subtotal).toBe(900)
    expect(discounted.total).toBeLessThan(full.total)
    expect(discounted.vat).toBeLessThan(full.vat)
  })

  it('labels discounts for UI', () => {
    expect(discountLabel('percent', 10)).toBe('10% off')
    expect(discountLabel('none', 0)).toBeNull()
  })
})

describe('folio discount credits', () => {
  it('scales room taxes when folio subtotal is negative', () => {
    const room = computeInvoiceTaxes(1000, 'exclusive')
    const merged = mergeRoomTaxesWithFolio(room, -100)
    expect(merged.subtotal).toBe(900)
    expect(merged.total).toBeLessThan(room.total)
    expect(merged.nhil).toBeLessThan(room.nhil)
  })
})
