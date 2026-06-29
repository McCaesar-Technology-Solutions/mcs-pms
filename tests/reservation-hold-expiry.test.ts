import { describe, expect, it } from 'vitest'
import {
  getHoldDuration,
  isHoldExpired,
  type ReservationHold,
} from '@/lib/reservations/cancellation-rules'

describe('reservation holds', () => {
  it('returns configured hold minutes per source', () => {
    const settings = {
      default_free_cancel_days: 7,
      default_refundable: true,
      default_penalty_nights: 1,
      hold_duration_online_minutes: 10,
      hold_duration_phone_minutes: 90,
      hold_duration_agent_minutes: 500,
    }
    expect(getHoldDuration('online', settings)).toBe(10)
    expect(getHoldDuration('phone', settings)).toBe(90)
    expect(getHoldDuration('agent', settings)).toBe(500)
  })

  it('detects expired holds', () => {
    const hold: ReservationHold = {
      reservation_id: 'r1',
      expires_at: '2020-01-01T00:00:00Z',
      hold_source: 'online',
      released_at: null,
    }
    expect(isHoldExpired(hold, new Date('2026-01-01T00:00:00Z'))).toBe(true)
    expect(
      isHoldExpired(
        { ...hold, released_at: '2026-01-01T00:00:00Z' },
        new Date('2026-01-01T00:00:00Z'),
      ),
    ).toBe(false)
  })
})
