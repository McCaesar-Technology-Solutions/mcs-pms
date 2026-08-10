import { describe, expect, it } from 'vitest'
import { calculateStayTotal, dailyRateForType, rateTypeLabel } from '@/lib/pricing/stay-totals'

describe('calculateStayTotal', () => {
  it('multiplies nightly rate by nights', () => {
    expect(calculateStayTotal('nightly', '2026-06-01', '2026-06-04', 100, 0)).toBe(300)
  })

  it('prorates weekly rate over 7-day weeks', () => {
    expect(calculateStayTotal('weekly', '2026-06-01', '2026-06-08', 0, 0, 700)).toBe(700)
    expect(calculateStayTotal('weekly', '2026-06-01', '2026-06-04', 0, 0, 700)).toBe(300)
  })

  it('prorates monthly rate over 30-day months', () => {
    expect(calculateStayTotal('monthly', '2026-06-01', '2026-06-31', 0, 3000)).toBe(3000)
    expect(calculateStayTotal('monthly', '2026-06-01', '2026-06-04', 0, 3000)).toBe(300)
  })
})

describe('dailyRateForType', () => {
  it('returns the correct daily equivalent', () => {
    expect(dailyRateForType('nightly', 100, 0, 0)).toBe(100)
    expect(dailyRateForType('weekly', 0, 0, 700)).toBe(100)
    expect(dailyRateForType('monthly', 0, 3000, 0)).toBe(100)
  })
})

describe('rateTypeLabel', () => {
  it('labels each rate type', () => {
    expect(rateTypeLabel('nightly')).toBe('Nightly')
    expect(rateTypeLabel('weekly')).toBe('Weekly (prorated)')
    expect(rateTypeLabel('monthly')).toBe('Monthly (prorated)')
  })
})
