import { describe, expect, it } from 'vitest'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'

describe('calculateStayTotal', () => {
  it('multiplies nightly rate by nights', () => {
    expect(calculateStayTotal('nightly', '2026-06-01', '2026-06-04', 100, 0)).toBe(300)
  })

  it('prorates monthly rate over 30-day months', () => {
    expect(calculateStayTotal('monthly', '2026-06-01', '2026-06-31', 0, 3000)).toBe(3000)
    expect(calculateStayTotal('monthly', '2026-06-01', '2026-06-04', 0, 3000)).toBe(300)
  })
})
