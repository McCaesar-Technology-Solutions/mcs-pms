import { describe, expect, it } from 'vitest'
import {
  canCancelReservationStatus,
  filterMetricsEligible,
  filterOpenBookings,
  isMetricsEligibleStatus,
  isOccupancyBlockingStatus,
  isOpenBookingStatus,
  isVoidedReservationStatus,
} from '@/lib/reservations/lifecycle'

describe('reservation lifecycle', () => {
  it('blocks occupancy only for confirmed and checked_in', () => {
    expect(isOccupancyBlockingStatus('confirmed')).toBe(true)
    expect(isOccupancyBlockingStatus('checked_in')).toBe(true)
    expect(isOccupancyBlockingStatus('checked_out')).toBe(false)
    expect(isOccupancyBlockingStatus('cancelled')).toBe(false)
    expect(isOccupancyBlockingStatus('no_show')).toBe(false)
  })

  it('treats cancelled and no_show as void', () => {
    expect(isVoidedReservationStatus('cancelled')).toBe(true)
    expect(isVoidedReservationStatus('no_show')).toBe(true)
    expect(isVoidedReservationStatus('confirmed')).toBe(false)
  })

  it('limits cancellation to confirmed only', () => {
    expect(canCancelReservationStatus('confirmed')).toBe(true)
    expect(canCancelReservationStatus('checked_in')).toBe(false)
    expect(canCancelReservationStatus('checked_out')).toBe(false)
  })

  it('filters metrics eligible rows', () => {
    const rows = [
      { id: '1', status: 'confirmed' },
      { id: '2', status: 'no_show' },
      { id: '3', status: 'checked_out' },
      { id: '4', status: 'cancelled' },
    ]
    expect(filterMetricsEligible(rows).map((r) => r.id)).toEqual(['1', '3'])
    expect(filterOpenBookings(rows).map((r) => r.id)).toEqual(['1'])
    expect(isMetricsEligibleStatus('no_show')).toBe(false)
    expect(isOpenBookingStatus('checked_out')).toBe(false)
  })
})
