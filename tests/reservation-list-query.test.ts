import { describe, expect, it } from 'vitest'
import {
  compareDeskReservationList,
  reservationStatusFilterValues,
  shouldPinOccupyingStays,
} from '@/lib/reservations/list-query'

describe('reservationStatusFilterValues', () => {
  it('treats In house as every occupying status', () => {
    expect(reservationStatusFilterValues('checked_in')).toEqual([
      'checked_in',
      'checkout_in_progress',
      'overstay',
      'dispute_hold',
    ])
  })

  it('leaves exact statuses unchanged', () => {
    expect(reservationStatusFilterValues('confirmed')).toEqual(['confirmed'])
    expect(reservationStatusFilterValues('all')).toBeNull()
  })
})

describe('shouldPinOccupyingStays', () => {
  it('pins occupying stays on the unfiltered All list', () => {
    expect(shouldPinOccupyingStays({ status: 'all' })).toBe(true)
  })

  it('does not pin when a date or status filter is active', () => {
    expect(shouldPinOccupyingStays({ status: 'checked_in' })).toBe(false)
    expect(shouldPinOccupyingStays({ status: 'all', checkInDate: '2026-08-16' })).toBe(false)
  })
})

describe('compareDeskReservationList', () => {
  it('lists occupying stays before upcoming bookings', () => {
    const inHouse = { status: 'checked_in', checkIn: '2026-08-01', checkOut: '2026-08-20' }
    const upcoming = { status: 'confirmed', checkIn: '2026-08-22', checkOut: '2026-08-25' }
    expect(compareDeskReservationList(inHouse, upcoming)).toBeLessThan(0)
    expect(compareDeskReservationList(upcoming, inHouse)).toBeGreaterThan(0)
  })

  it('sorts occupying stays by soonest departure', () => {
    const laterOut = { status: 'checked_in', checkIn: '2026-08-01', checkOut: '2026-08-22' }
    const soonerOut = { status: 'overstay', checkIn: '2026-08-10', checkOut: '2026-08-16' }
    expect(compareDeskReservationList(soonerOut, laterOut)).toBeLessThan(0)
  })
})
