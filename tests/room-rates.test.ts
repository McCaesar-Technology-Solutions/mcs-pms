import { describe, expect, it } from 'vitest'
import { resolveRoomRates } from '@/lib/pricing/room-rates'

describe('resolveRoomRates', () => {
  it('prefers room overrides over category defaults', () => {
    expect(
      resolveRoomRates(
        { nightly_rate: 400, weekly_rate: 2500, monthly_rate: 9000 },
        { default_nightly_rate: 300, default_weekly_rate: 1800, default_monthly_rate: 7000 },
      ),
    ).toEqual({ nightlyRate: 400, weeklyRate: 2500, monthlyRate: 9000 })
  })

  it('falls back to category defaults when room rates are null', () => {
    expect(
      resolveRoomRates(
        { nightly_rate: null, weekly_rate: null, monthly_rate: null },
        { default_nightly_rate: 300, default_weekly_rate: 1800, default_monthly_rate: 7000 },
      ),
    ).toEqual({ nightlyRate: 300, weeklyRate: 1800, monthlyRate: 7000 })
  })

  it('uses 0 when both room and category are unset (matches booking)', () => {
    expect(resolveRoomRates({ nightly_rate: null }, { default_nightly_rate: 250 })).toEqual({
      nightlyRate: 250,
      weeklyRate: 0,
      monthlyRate: 0,
    })
    expect(resolveRoomRates(null, null)).toEqual({
      nightlyRate: 0,
      weeklyRate: 0,
      monthlyRate: 0,
    })
  })
})
