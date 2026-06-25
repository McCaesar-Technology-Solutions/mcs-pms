import { describe, expect, it } from 'vitest'
import { isAllowedImportUrl } from '@/lib/channels/import-url'

describe('isAllowedImportUrl', () => {
  it('allows public HTTPS OTA URLs', () => {
    expect(isAllowedImportUrl('https://www.airbnb.com/calendar/ical/abc123.ics')).toBe(true)
    expect(isAllowedImportUrl('https://admin.booking.com/hotel/hoteladmin/ical.html?t=xyz')).toBe(
      true,
    )
  })

  it('blocks non-HTTPS and internal hosts', () => {
    expect(isAllowedImportUrl('http://www.airbnb.com/calendar/ical/abc.ics')).toBe(false)
    expect(isAllowedImportUrl('https://localhost/cal.ics')).toBe(false)
    expect(isAllowedImportUrl('https://127.0.0.1/cal.ics')).toBe(false)
    expect(isAllowedImportUrl('https://192.168.1.10/cal.ics')).toBe(false)
    expect(isAllowedImportUrl('not-a-url')).toBe(false)
  })
})
