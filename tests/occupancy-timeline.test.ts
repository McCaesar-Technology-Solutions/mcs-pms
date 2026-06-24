import { describe, expect, it } from 'vitest'
import {
  isFirstVisibleStayDate,
  nightsBetween,
  stayCoversDate,
  stayDates,
  type OccupancyTimelineBar,
} from '@/lib/data/occupancy-timeline'

describe('stayCoversDate', () => {
  it('treats check-out as exclusive (departure day is not occupied)', () => {
    expect(stayCoversDate('2026-06-01', '2026-06-05', '2026-06-01')).toBe(true)
    expect(stayCoversDate('2026-06-01', '2026-06-05', '2026-06-04')).toBe(true)
    expect(stayCoversDate('2026-06-01', '2026-06-05', '2026-06-05')).toBe(false)
  })
})

describe('stayDates', () => {
  it('lists one box per occupied night', () => {
    expect(stayDates('2026-06-01', '2026-06-04')).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ])
    expect(nightsBetween('2026-06-01', '2026-06-04')).toBe(3)
  })

  it('supports multi-week monthly stays', () => {
    expect(stayDates('2026-06-01', '2026-07-01')).toHaveLength(30)
  })
})

describe('isFirstVisibleStayDate', () => {
  const bar: OccupancyTimelineBar = {
    id: '1',
    roomId: 'r1',
    roomNumber: '1',
    guestName: 'Ada',
    checkIn: '2026-06-01',
    checkOut: '2026-06-20',
    source: 'walk_in',
    kind: 'reservation',
  }

  it('uses range start when stay began earlier', () => {
    expect(isFirstVisibleStayDate(bar, '2026-06-10', '2026-06-10')).toBe(true)
    expect(isFirstVisibleStayDate(bar, '2026-06-11', '2026-06-10')).toBe(false)
  })
})
