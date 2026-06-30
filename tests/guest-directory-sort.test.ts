import { describe, expect, it } from 'vitest'
import { sortGuestDirectory, type GuestRow } from '@/lib/data/guests'

function guest(overrides: Partial<GuestRow> & Pick<GuestRow, 'id' | 'name'>): GuestRow {
  return {
    email: null,
    phone: null,
    roomNumber: null,
    roomId: null,
    checkIn: null,
    checkOut: null,
    totalStays: 1,
    totalSpent: 0,
    lastStay: null,
    status: 'new',
    source: null,
    token: null,
    tokenExpiresAt: null,
    reservationId: null,
    isInHouse: false,
    doNotDisturb: false,
    ...overrides,
  }
}

describe('sortGuestDirectory', () => {
  it('lists in-house guests before checked-out guests', () => {
    const sorted = sortGuestDirectory([
      guest({ id: '1', name: 'Zara', isInHouse: false, lastStay: '2026-06-20' }),
      guest({ id: '2', name: 'Amy', isInHouse: true, checkOut: '2026-06-28' }),
      guest({ id: '3', name: 'Ben', isInHouse: false, lastStay: '2026-06-25' }),
      guest({ id: '4', name: 'Cara', isInHouse: true, checkOut: '2026-06-26' }),
    ])

    expect(sorted.map((g) => g.id)).toEqual(['4', '2', '3', '1'])
  })
})
