import { describe, expect, it } from 'vitest'
import {
  extendStayThroughToday,
  groupTimelineRoomsByFloor,
  isFirstVisibleStayDate,
  nightsBetween,
  stayCoversDate,
  stayDates,
  type OccupancyTimelineBar,
} from '@/lib/data/occupancy-timeline'

describe('extendStayThroughToday', () => {
  it('keeps a future check-out', () => {
    expect(extendStayThroughToday('2026-08-20', '2026-08-16')).toBe('2026-08-20')
  })

  it('extends a past check-out through today', () => {
    expect(extendStayThroughToday('2026-08-14', '2026-08-16')).toBe('2026-08-17')
    expect(stayCoversDate('2026-08-01', extendStayThroughToday('2026-08-14', '2026-08-16'), '2026-08-16')).toBe(
      true,
    )
  })
})

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

describe('groupTimelineRoomsByFloor', () => {
  it('groups rooms by floor and sorts floors descending', () => {
    const grouped = groupTimelineRoomsByFloor([
      { id: 'a', number: '101', floor: 1 },
      { id: 'b', number: '201', floor: 2 },
      { id: 'c', number: '102', floor: 1 },
    ])
    expect(grouped.map((g) => g.floor)).toEqual([2, 1])
    expect(grouped[1]?.rooms.map((r) => r.number)).toEqual(['101', '102'])
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
