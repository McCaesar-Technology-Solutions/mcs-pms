import { describe, expect, it } from 'vitest'
import { generatePortalPin, normalizePortalPin, PORTAL_PIN_LENGTH } from '@/lib/guest/portal-pin'
import { guestRoomEntrySchema } from '@/lib/validations'

describe('portal PIN', () => {
  it('generates a zero-padded numeric PIN', () => {
    for (let i = 0; i < 20; i++) {
      const pin = generatePortalPin()
      expect(pin).toMatch(new RegExp(`^\\d{${PORTAL_PIN_LENGTH}}$`))
    }
  })

  it('normalizes user input to digits', () => {
    expect(normalizePortalPin(' 1 2-3 4 ')).toBe('1234')
    expect(normalizePortalPin('abcd')).toBe('')
  })
})

describe('guestRoomEntrySchema', () => {
  const base = { slug: 'mojo-apartments', roomNumber: 'B204' }

  it('accepts a valid 4-digit PIN (with stray spaces)', () => {
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '1234' }).success).toBe(true)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: ' 12 34 ' }).success).toBe(true)
  })

  it('rejects missing or malformed PINs', () => {
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '12' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: 'abcd' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '12345' }).success).toBe(false)
  })
})
