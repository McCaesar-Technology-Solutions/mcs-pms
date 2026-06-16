import { describe, expect, it } from 'vitest'
import { formatComplaintVisit, isVisitTimeValid, parseVisitDateTime } from '@/lib/complaints/visit'

describe('visit scheduling helpers', () => {
  it('parses ISO datetime strings', () => {
    const date = parseVisitDateTime('2026-06-15T14:30:00.000Z')
    expect(date).toBeInstanceOf(Date)
    expect(date?.toISOString()).toBe('2026-06-15T14:30:00.000Z')
  })

  it('rejects invalid datetimes', () => {
    expect(parseVisitDateTime('not-a-date')).toBeNull()
  })

  it('requires visits to be at least 30 minutes ahead', () => {
    const now = Date.parse('2026-06-15T12:00:00.000Z')
    expect(isVisitTimeValid(new Date('2026-06-15T12:20:00.000Z'), now)).toBe(false)
    expect(isVisitTimeValid(new Date('2026-06-15T12:31:00.000Z'), now)).toBe(true)
  })

  it('formats visits for display', () => {
    const formatted = formatComplaintVisit('2026-06-15T14:30:00.000Z')
    expect(formatted.length).toBeGreaterThan(0)
  })
})
