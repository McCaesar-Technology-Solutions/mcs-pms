import { describe, expect, it } from 'vitest'
import { isOccupancyBlockingStatus } from '@/lib/reservations/lifecycle'

describe('occupancy', () => {
  it('treats provisional holds as inventory-blocking', () => {
    expect(isOccupancyBlockingStatus('provisional')).toBe(true)
    expect(isOccupancyBlockingStatus('confirmed')).toBe(true)
    expect(isOccupancyBlockingStatus('released')).toBe(false)
  })
})
