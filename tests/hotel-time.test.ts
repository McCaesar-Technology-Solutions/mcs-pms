import { describe, expect, it } from 'vitest'
import {
  hotelLocalMinutes,
  hotelTodayISO,
  isIsoDateString,
  isPastHotelLocalTime,
  normalizeHotelTimezone,
} from '@/lib/hotel-time'

describe('hotel-time', () => {
  it('defaults invalid timezone to Africa/Accra', () => {
    expect(normalizeHotelTimezone('Not/A/Zone')).toBe('Africa/Accra')
    expect(normalizeHotelTimezone('Africa/Accra')).toBe('Africa/Accra')
  })

  it('formats today in property timezone', () => {
    const noonUtc = new Date('2026-06-15T12:00:00.000Z')
    const accra = hotelTodayISO('Africa/Accra', noonUtc)
    expect(accra).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('compares local clock to configured hotel time', () => {
    const morningAccra = new Date('2026-06-15T08:00:00.000Z')
    expect(isPastHotelLocalTime('Africa/Accra', '10:00 AM', morningAccra)).toBe(false)
    expect(isPastHotelLocalTime('Africa/Accra', '08:00', morningAccra)).toBe(true)
  })

  it('returns sensible local minutes', () => {
    const d = new Date('2026-01-15T12:00:00.000Z')
    const mins = hotelLocalMinutes('Africa/Accra', d)
    expect(mins).toBeGreaterThanOrEqual(0)
    expect(mins).toBeLessThan(24 * 60)
  })

  it('accepts real calendar dates only', () => {
    expect(isIsoDateString('2026-08-20')).toBe(true)
    expect(isIsoDateString('2026-02-29')).toBe(false)
    expect(isIsoDateString('20-08-2026')).toBe(false)
    expect(isIsoDateString('2026-08-20T12:00:00')).toBe(false)
  })
})
