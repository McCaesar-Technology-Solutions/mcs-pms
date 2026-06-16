import { describe, expect, it } from 'vitest'
import {
  buildPropertyJoinPath,
  isValidGuestPortalSlug,
  normalizeRoomNumber,
  slugifyHotelName,
} from '@/lib/guest-portal'

describe('normalizeRoomNumber', () => {
  it('strips room prefix and normalizes spacing', () => {
    expect(normalizeRoomNumber('Room 12')).toBe('12')
    expect(normalizeRoomNumber('  B204 ')).toBe('b204')
    expect(normalizeRoomNumber('room12')).toBe('12')
  })

  it('rejects empty input', () => {
    expect(normalizeRoomNumber('')).toBe('')
    expect(normalizeRoomNumber('   ')).toBe('')
  })
})

describe('guest portal slug helpers', () => {
  it('slugifies hotel names', () => {
    expect(slugifyHotelName('MOJO Apartments Accra')).toBe('mojo-apartments-accra')
  })

  it('validates portal slugs', () => {
    expect(isValidGuestPortalSlug('mojo-apartments-a1b2c3')).toBe(true)
    expect(isValidGuestPortalSlug('ab')).toBe(false)
    expect(isValidGuestPortalSlug('Bad_Slug')).toBe(false)
  })

  it('builds join paths', () => {
    expect(buildPropertyJoinPath('mojo-accra-abc123')).toBe('/guest/join/mojo-accra-abc123')
  })
})
