import { describe, expect, it } from 'vitest'
import {
  INDEFINITE_OCCUPANCY_STATUSES,
  isOccupancyBlockingStatus,
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
})
