import { describe, expect, it } from 'vitest'
import {
  calculateNoShowChargeAmount,
  calculateOverstayChargeAmount,
} from '@/lib/reservations/lifecycle-charges'

const baseReservation = {
  id: 'r1',
  hotel_id: 'h1',
  guest_id: 'g1',
  check_in: '2026-06-01',
  check_out: '2026-06-04',
  room_id: 'room1',
  nightly_rate: 200,
  weekly_rate: 1400,
  monthly_rate: 4500,
  rate_type: 'nightly' as const,
  total_amount: 600,
  amount_paid: 0,
}

describe('lifecycle charges', () => {
  it('calculates no-show one night', () => {
    expect(
      calculateNoShowChargeAmount(baseReservation, 'one_night', 200, 4500, 1400),
    ).toBe(200)
  })

  it('calculates no-show one night for weekly rate', () => {
    expect(
      calculateNoShowChargeAmount(
        { ...baseReservation, rate_type: 'weekly' },
        'one_night',
        200,
        4500,
        1400,
      ),
    ).toBe(200)
  })

  it('calculates no-show full stay from booked total', () => {
    expect(
      calculateNoShowChargeAmount(baseReservation, 'full_stay', 200, 4500, 1400),
    ).toBe(600)
  })

  it('returns zero for no-show none policy', () => {
    expect(
      calculateNoShowChargeAmount(baseReservation, 'none', 200, 4500, 1400),
    ).toBe(0)
  })

  it('calculates overstay as one extra night', () => {
    expect(
      calculateOverstayChargeAmount(baseReservation, 200, 4500, 1400),
    ).toBe(200)
  })
})
