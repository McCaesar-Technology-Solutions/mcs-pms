import { describe, expect, it } from 'vitest'
import { phoneDigits, hasPhoneNumber, telHref, whatsAppHref, phoneSchema } from '@/lib/phone'
import { toE164 } from '@/lib/notifications/e164'

describe('phoneDigits', () => {
  it('strips all non-digit characters', () => {
    expect(phoneDigits('+233 (24) 123-4567')).toBe('233241234567')
    expect(phoneDigits('024 123 4567')).toBe('0241234567')
  })
})

describe('hasPhoneNumber', () => {
  it('detects presence of a trimmed value', () => {
    expect(hasPhoneNumber('024')).toBe(true)
    expect(hasPhoneNumber('   ')).toBe(false)
    expect(hasPhoneNumber(null)).toBe(false)
    expect(hasPhoneNumber(undefined)).toBe(false)
  })
})

describe('telHref / whatsAppHref', () => {
  it('builds tel and wa.me links from digits', () => {
    expect(telHref('024 123 4567')).toBe('tel:0241234567')
    expect(whatsAppHref('+233241234567')).toBe('https://wa.me/233241234567')
  })

  it('encodes an optional WhatsApp message', () => {
    expect(whatsAppHref('+233241234567', 'Hi there')).toBe(
      'https://wa.me/233241234567?text=Hi%20there',
    )
  })

  it('returns empty string when there are no digits', () => {
    expect(telHref('abc')).toBe('')
    expect(whatsAppHref('---')).toBe('')
  })
})

describe('toE164 (Ghana)', () => {
  it('converts a local 0-prefixed number', () => {
    expect(toE164('024 123 4567')).toBe('+233241234567')
  })

  it('adds the country code to a bare 9-10 digit number', () => {
    expect(toE164('241234567')).toBe('+233241234567')
  })

  it('keeps an already-normalized number', () => {
    expect(toE164('+233241234567')).toBe('+233241234567')
  })

  it('returns empty string for empty input', () => {
    expect(toE164('')).toBe('')
  })
})

describe('phoneSchema', () => {
  it('requires at least 9 digits', () => {
    expect(phoneSchema.safeParse('0241234567').success).toBe(true)
    expect(phoneSchema.safeParse('123').success).toBe(false)
    expect(phoneSchema.safeParse('').success).toBe(false)
  })
})
