import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { generatePortalPin, normalizePortalPin, PORTAL_PIN_LENGTH } from '@/lib/guest/portal-pin'
import {
  hashPortalPin,
  revealStoredPortalPin,
  sealPortalPin,
  verifyPortalPin,
} from '@/lib/guest/portal-pin-crypto'
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
  const prev = process.env.GUEST_SESSION_SECRET

  beforeEach(() => {
    process.env.GUEST_SESSION_SECRET = 'test-secret-for-portal-pin'
  })

  afterEach(() => {
    process.env.GUEST_SESSION_SECRET = prev
  })

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

  it('does not treat sealed ciphertext as legacy plaintext', async () => {
    const guestId = '00000000-0000-4000-8000-000000000001'
    const sealed = await sealPortalPin('123456')
    expect(await verifyPortalPin(guestId, '123456', null, sealed)).toBe(false)
  })

  it('seals a PIN for staff reveal without storing plaintext', async () => {
    const pin = '654321'
    const sealed = await sealPortalPin(pin)
    expect(sealed.startsWith('enc:v1:')).toBe(true)
    expect(sealed.includes(pin)).toBe(false)
    expect(await revealStoredPortalPin(sealed)).toBe(pin)
    expect(await revealStoredPortalPin('123456')).toBe('123456')
    expect(await revealStoredPortalPin(null)).toBeNull()
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
