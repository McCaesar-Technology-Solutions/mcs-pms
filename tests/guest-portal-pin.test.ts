import { describe, expect, it } from 'vitest'
import { generatePortalPin, normalizePortalPin, PORTAL_PIN_LENGTH } from '@/lib/guest/portal-pin'
import { hashPortalPin, verifyPortalPin } from '@/lib/guest/portal-pin-crypto'
import { guestRoomEntrySchema } from '@/lib/validations'

describe('portal PIN', () => {
  it('generates a zero-padded numeric PIN', () => {
    for (let i = 0; i < 20; i++) {
      const pin = generatePortalPin()
      expect(pin).toMatch(new RegExp(`^\\d{${PORTAL_PIN_LENGTH}}$`))
    }
  })

  it('normalizes user input to digits', () => {
    expect(normalizePortalPin(' 1 2-3 4 56 ')).toBe('123456')
    expect(normalizePortalPin('abcd')).toBe('')
  })
})

describe('portal PIN hashing', () => {
  it('verifies hashed PINs and rejects wrong PINs', async () => {
    const guestId = '00000000-0000-4000-8000-000000000001'
    const pin = '123456'
    const hash = await hashPortalPin(guestId, pin)

    expect(await verifyPortalPin(guestId, pin, hash, null)).toBe(true)
    expect(await verifyPortalPin(guestId, '654321', hash, null)).toBe(false)
  })

  it('supports legacy plaintext during migration', async () => {
    const guestId = '00000000-0000-4000-8000-000000000001'
    expect(await verifyPortalPin(guestId, '123456', null, '123456')).toBe(true)
    expect(await verifyPortalPin(guestId, '000000', null, '123456')).toBe(false)
  })
})

describe('guestRoomEntrySchema', () => {
  const base = { slug: 'mojo-apartments', roomNumber: 'B204' }

  it('accepts a valid 6-digit PIN (with stray spaces)', () => {
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '123456' }).success).toBe(true)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: ' 12 34 56 ' }).success).toBe(true)
  })

  it('rejects missing or malformed PINs', () => {
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '12' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: 'abcd' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '1234' }).success).toBe(false)
    expect(guestRoomEntrySchema.safeParse({ ...base, portalPin: '1234567' }).success).toBe(false)
  })
})
