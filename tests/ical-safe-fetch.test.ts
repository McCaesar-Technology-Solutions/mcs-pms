import { describe, expect, it } from 'vitest'
import { hashIcsBody, isAirbnbCalendarHost, validateImportUrl } from '@/lib/ical/safe-fetch'

describe('validateImportUrl', () => {
  it('accepts https Airbnb URLs', () => {
    const result = validateImportUrl(
      'https://www.airbnb.com/calendar/ical/123.ics?s=secret',
    )
    expect(result.ok).toBe(true)
  })

  it('rejects http and credentialed URLs', () => {
    expect(validateImportUrl('http://www.airbnb.com/calendar/ical/1.ics').ok).toBe(false)
    expect(validateImportUrl('https://user:pass@www.airbnb.com/calendar/ical/1.ics').ok).toBe(
      false,
    )
  })

  it('rejects localhost and private IP literals', () => {
    expect(validateImportUrl('https://localhost/cal.ics').ok).toBe(false)
    expect(validateImportUrl('https://127.0.0.1/cal.ics').ok).toBe(false)
    expect(validateImportUrl('https://192.168.1.10/cal.ics').ok).toBe(false)
    expect(validateImportUrl('https://169.254.169.254/latest/meta-data').ok).toBe(false)
    expect(validateImportUrl('https://[::ffff:127.0.0.1]/cal.ics').ok).toBe(false)
  })
})

describe('isAirbnbCalendarHost', () => {
  it('allows airbnb and muscache hosts', () => {
    expect(isAirbnbCalendarHost('www.airbnb.com')).toBe(true)
    expect(isAirbnbCalendarHost('a0.muscache.com')).toBe(true)
    expect(isAirbnbCalendarHost('evil.com')).toBe(false)
  })
})

describe('hashIcsBody', () => {
  it('is stable for the same body', () => {
    expect(hashIcsBody('BEGIN:VCALENDAR')).toBe(hashIcsBody('BEGIN:VCALENDAR'))
    expect(hashIcsBody('A')).not.toBe(hashIcsBody('B'))
  })
})
