import { occupancyWindowForCurrentStay } from '@/lib/data/occupancy'
import { describe, expect, it } from 'vitest'
import {
  INDEFINITE_OCCUPANCY_STATUSES,
  isOccupancyBlockingStatus,
  isOccupyingReservationStatus,
  OCCUPYING_STATUSES,
  STALE_IN_HOUSE_STATUSES,
} from '@/lib/reservations/lifecycle'

describe('occupancy', () => {
  it('treats provisional holds as inventory-blocking', () => {
    expect(isOccupancyBlockingStatus('provisional')).toBe(true)
    expect(isOccupancyBlockingStatus('confirmed')).toBe(true)
    expect(isOccupancyBlockingStatus('released')).toBe(false)
  })

  it('treats overstay and dispute_hold as indefinite room blocks', () => {
    expect(INDEFINITE_OCCUPANCY_STATUSES).toContain('overstay')
    expect(INDEFINITE_OCCUPANCY_STATUSES).toContain('dispute_hold')
  })

  it('treats stale in-house statuses as past-departure room holds', () => {
    expect(STALE_IN_HOUSE_STATUSES).toContain('checked_in')
    expect(STALE_IN_HOUSE_STATUSES).toContain('checkout_in_progress')
  })

  it('includes dispute hold in occupying statuses used for folio and requests', () => {
    expect(OCCUPYING_STATUSES).toContain('dispute_hold')
    expect(isOccupyingReservationStatus('dispute_hold')).toBe(true)
  })

  it('extends an overstay move window through tomorrow so the new room is checked', () => {
    expect(
      occupancyWindowForCurrentStay('2026-08-01', '2026-08-10', 'overstay', '2026-08-20'),
    ).toEqual({ checkIn: '2026-08-01', checkOut: '2026-08-21' })
    expect(
      occupancyWindowForCurrentStay('2026-08-01', '2026-08-25', 'checked_in', '2026-08-20'),
    ).toEqual({ checkIn: '2026-08-01', checkOut: '2026-08-25' })
  })
})
