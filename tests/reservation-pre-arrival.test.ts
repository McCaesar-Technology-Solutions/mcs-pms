import { describe, expect, it } from 'vitest'
import { preArrivalPromotionCheckInDates } from '@/lib/cron/reservation-pre-arrival'

describe('pre-arrival promotion dates', () => {
  it('includes today and two days out', () => {
    expect(preArrivalPromotionCheckInDates('2026-06-15')).toEqual([
      '2026-06-15',
      '2026-06-17',
    ])
  })
})
