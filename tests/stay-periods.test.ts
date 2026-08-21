import { describe, expect, it } from 'vitest'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'
import {
  billingPeriodLabel,
  stayBillingPeriods,
  splitAmountByWeights,
  waterfallAllocate,
} from '@/lib/billing/stay-periods'

describe('stayBillingPeriods', () => {
  it('keeps a short monthly stay as one invoice period', () => {
    const periods = stayBillingPeriods('2026-06-17', '2026-07-07', 'monthly')
    expect(periods).toHaveLength(1)
    expect(periods[0]).toMatchObject({ start: '2026-06-17', end: '2026-07-07', nights: 20, count: 1 })
  })

  it('splits a 90-night monthly stay into three unique months', () => {
    const periods = stayBillingPeriods('2026-06-17', '2026-09-15', 'monthly')
    expect(periods.map((p) => ({ start: p.start, end: p.end, nights: p.nights }))).toEqual([
      { start: '2026-06-17', end: '2026-07-17', nights: 30 },
      { start: '2026-07-17', end: '2026-08-16', nights: 30 },
      { start: '2026-08-16', end: '2026-09-15', nights: 30 },
    ])
    expect(periods.every((p) => p.count === 3)).toBe(true)

    const monthCharge = 7000
    const parts = periods.map((p) =>
      calculateStayTotal('monthly', p.start, p.end, 0, monthCharge),
    )
    expect(parts).toEqual([7000, 7000, 7000])
    expect(parts.reduce((s, n) => s + n, 0)).toBe(
      calculateStayTotal('monthly', '2026-06-17', '2026-09-15', 0, monthCharge),
    )
  })

  it('does not split nightly or weekly stays', () => {
    expect(stayBillingPeriods('2026-06-17', '2026-09-15', 'nightly')).toHaveLength(1)
    expect(stayBillingPeriods('2026-06-17', '2026-09-15', 'weekly')).toHaveLength(1)
  })
})

describe('waterfallAllocate', () => {
  it('fills earlier months first', () => {
    expect(waterfallAllocate([7000, 7000, 7000], 14000)).toEqual([7000, 7000, 0])
    expect(waterfallAllocate([7000, 7000, 7000], 7000)).toEqual([7000, 0, 0])
    expect(waterfallAllocate([7000, 7000, 7000], 21000)).toEqual([7000, 7000, 7000])
  })
})

describe('splitAmountByWeights', () => {
  it('splits a stay discount across months without losing pesewas', () => {
    expect(splitAmountByWeights(300, [7000, 7000, 7000])).toEqual([100, 100, 100])
    const parts = splitAmountByWeights(10, [7000, 7000, 7000])
    expect(parts.reduce((s, n) => s + n, 0)).toBe(10)
  })
})

describe('billingPeriodLabel', () => {
  it('names each month of a multi-month stay', () => {
    const [first] = stayBillingPeriods('2026-06-17', '2026-09-15', 'monthly')
    expect(billingPeriodLabel(first!)).toBe('Month 1 of 3')
  })
})
