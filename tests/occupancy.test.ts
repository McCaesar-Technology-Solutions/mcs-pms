import { describe, expect, it } from 'vitest'
import {
  INDEFINITE_OCCUPANCY_STATUSES,
  isOccupancyBlockingStatus,
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
})
