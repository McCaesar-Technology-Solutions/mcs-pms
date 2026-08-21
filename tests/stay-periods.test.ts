import { describe, expect, it } from 'vitest'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'
import {
  billingPeriodLabel,
  coverStayInvoicePeriods,
  indexStayPeriods,
  lastActivePeriodEnd,
  lifoShortenStayInvoices,
  missingExtensionSlice,
  stayInvoiceNights,
  stayInvoicePeriodsFromRows,
  splitAmountByWeights,
  waterfallAllocate,
} from '@/lib/billing/stay-periods'

describe('stayInvoicePeriodsFromRows', () => {
  it('keeps a 90-night original monthly booking as one invoice period', () => {
    const periods = stayInvoicePeriodsFromRows([], '2026-06-17', '2026-09-15')
    expect(periods).toHaveLength(1)
    expect(periods[0]).toMatchObject({
      start: '2026-06-17',
      end: '2026-09-15',
      nights: 90,
      count: 1,
    })
    expect(calculateStayTotal('monthly', '2026-06-17', '2026-09-15', 0, 7000)).toBe(21000)
  })

  it('adds a unique period per extension instead of growing the original', () => {
    const afterFirst = stayInvoicePeriodsFromRows(
      [{ billing_period_start: '2026-06-17', billing_period_end: '2026-06-20' }],
      '2026-06-17',
      '2026-06-23',
    )
    const gap = missingExtensionSlice(lastActivePeriodEnd(afterFirst), '2026-06-23')
    expect(gap).toEqual({ start: '2026-06-20', end: '2026-06-23' })

    const afterExtend = stayInvoicePeriodsFromRows(
      [
        { billing_period_start: '2026-06-17', billing_period_end: '2026-06-20' },
        { billing_period_start: '2026-06-20', billing_period_end: '2026-06-23' },
      ],
      '2026-06-17',
      '2026-06-23',
    )
    expect(afterExtend).toHaveLength(2)
    expect(missingExtensionSlice(lastActivePeriodEnd(afterExtend), '2026-06-23')).toBeNull()

    const afterSecondGap = missingExtensionSlice(lastActivePeriodEnd(afterExtend), '2026-06-27')
    expect(afterSecondGap).toEqual({ start: '2026-06-23', end: '2026-06-27' })
    const three = indexStayPeriods([
      { start: '2026-06-17', end: '2026-06-20' },
      { start: '2026-06-20', end: '2026-06-23' },
      { start: '2026-06-23', end: '2026-06-27' },
    ])
    expect(three).toHaveLength(3)
  })
})

describe('coverStayInvoicePeriods', () => {
  it('does not grow a stamped original invoice', () => {
    const periods = coverStayInvoicePeriods(
      [{ billing_period_start: '2026-06-17', billing_period_end: '2026-06-20' }],
      '2026-06-17',
      '2026-06-23',
    )
    expect(periods.map((p) => ({ start: p.start, end: p.end, nights: p.nights }))).toEqual([
      { start: '2026-06-17', end: '2026-06-20', nights: 3 },
      { start: '2026-06-20', end: '2026-06-23', nights: 3 },
    ])
  })

  it('reactivates a dropped extension instead of inserting a duplicate start', () => {
    const periods = coverStayInvoicePeriods(
      [
        { billing_period_start: '2026-06-17', billing_period_end: '2026-06-20' },
        { billing_period_start: '2026-06-20', billing_period_end: '2026-06-20' },
      ],
      '2026-06-17',
      '2026-06-25',
    )
    expect(periods).toHaveLength(2)
    expect(periods[1]).toMatchObject({ start: '2026-06-20', end: '2026-06-25', nights: 5 })
  })
})

describe('lifoShortenStayInvoices', () => {
  it('only shrinks the latest extension', () => {
    const actions = lifoShortenStayInvoices(
      [
        { start: '2026-06-17', end: '2026-06-20' },
        { start: '2026-06-20', end: '2026-06-23' },
        { start: '2026-06-23', end: '2026-06-27' },
      ],
      '2026-06-25',
    )
    expect(actions.map((a) => a.action)).toEqual(['keep', 'keep', 'shrink'])
    expect(actions[2]).toMatchObject({ start: '2026-06-23', end: '2026-06-25', nights: 2 })
    expect(actions[0]).toMatchObject({ start: '2026-06-17', end: '2026-06-20' })
  })

  it('drops later extensions then shrinks the overlapping invoice', () => {
    const actions = lifoShortenStayInvoices(
      [
        { start: '2026-06-17', end: '2026-06-20' },
        { start: '2026-06-20', end: '2026-06-23' },
      ],
      '2026-06-19',
    )
    expect(actions[1]).toMatchObject({ action: 'drop', nights: 0, end: '2026-06-20' })
    expect(actions[0]).toMatchObject({ action: 'shrink', end: '2026-06-19', nights: 2 })
  })
})

describe('stayInvoiceNights', () => {
  it('returns 0 for a dropped extension with equal dates', () => {
    expect(stayInvoiceNights('2026-06-23', '2026-06-23')).toBe(0)
  })
})

describe('waterfallAllocate', () => {
  it('fills the original stay invoice first', () => {
    expect(waterfallAllocate([300, 200, 100], 350)).toEqual([300, 50, 0])
    expect(waterfallAllocate([300, 200, 100], 300)).toEqual([300, 0, 0])
    expect(waterfallAllocate([300, 200, 100], 600)).toEqual([300, 200, 100])
  })
})

describe('splitAmountByWeights', () => {
  it('splits a stay discount across segments without losing pesewas', () => {
    expect(splitAmountByWeights(300, [7000, 7000, 7000])).toEqual([100, 100, 100])
    const parts = splitAmountByWeights(10, [7000, 7000, 7000])
    expect(parts.reduce((s, n) => s + n, 0)).toBe(10)
  })
})

describe('billingPeriodLabel', () => {
  it('names the original stay and each unique extension', () => {
    const periods = indexStayPeriods([
      { start: '2026-06-17', end: '2026-06-20' },
      { start: '2026-06-20', end: '2026-06-23' },
      { start: '2026-06-23', end: '2026-06-27' },
    ])
    expect(billingPeriodLabel(periods[0]!)).toBe('Stay')
    expect(billingPeriodLabel(periods[1]!)).toBe('Extension 1 of 2')
    expect(billingPeriodLabel(periods[2]!)).toBe('Extension 2 of 2')
  })
})
