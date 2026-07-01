import { describe, expect, it } from 'vitest'
import {
  calendarMonthFromParts,
  currentCalendarMonth,
  currentCalendarYear,
  periodAuditLabel,
} from '@/lib/audits/period'

describe('audit period helpers', () => {
  it('builds calendar month boundaries', () => {
    const june = calendarMonthFromParts(2026, 6)
    expect(june.key).toBe('2026-06')
    expect(june.startDate).toBe('2026-06-01')
    expect(june.endDate).toBe('2026-06-30')
    expect(june.daysInMonth).toBe(30)
  })

  it('labels monthly and yearly periods', () => {
    expect(periodAuditLabel('monthly', 2026, 6)).toContain('2026')
    expect(periodAuditLabel('yearly', 2026, null)).toBe('2026')
  })

  it('resolves current period keys', () => {
    const month = currentCalendarMonth(new Date('2026-03-15T12:00:00'))
    expect(month.key).toBe('2026-03')
    const year = currentCalendarYear(new Date('2026-03-15T12:00:00'))
    expect(year.key).toBe('2026')
    expect(year.startDate).toBe('2026-01-01')
    expect(year.endDate).toBe('2026-12-31')
  })
})
