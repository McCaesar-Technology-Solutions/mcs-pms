import { describe, expect, it } from 'vitest'
import {
  buildGuestDirectoryFields,
  deriveGuestLoyalty,
  deriveGuestOccupancy,
  guestMatchesDirectoryFilter,
  guestRoomLabel,
  parseGuestDirectoryFilter,
  sortGuestDirectory,
  VIP_SPEND_THRESHOLD,
  VIP_STAYS_THRESHOLD,
  type GuestRow,
  type GuestStayInput,
} from '@/lib/guests/guest-directory'

function guest(overrides: Partial<GuestRow> & Pick<GuestRow, 'id' | 'name'>): GuestRow {
  return {
    email: null,
    phone: null,
    ghanaCardNumber: null,
    roomNumber: null,
    roomId: null,
    checkIn: null,
    checkOut: null,
    totalStays: 1,
    totalSpent: 0,
    lastStay: null,
    occupancy: 'departed',
    loyalty: 'new',
    source: null,
    token: null,
    tokenExpiresAt: null,
    portalPin: null,
    reservationId: null,
    isInHouse: false,
    canCheckOut: false,
    doNotDisturb: false,
    ...overrides,
  }
}

function stay(overrides: Partial<GuestStayInput> & Pick<GuestStayInput, 'status'>): GuestStayInput {
  return {
    id: overrides.id ?? 'res-1',
    check_in: '2026-08-01',
    check_out: '2026-08-13',
    created_at: '2026-08-01T10:00:00Z',
    channel: 'walk_in',
    total_amount: 800,
    ...overrides,
  }
}

describe('parseGuestDirectoryFilter', () => {
  it('maps legacy active to in_house', () => {
    expect(parseGuestDirectoryFilter('active')).toBe('in_house')
  })

  it('accepts occupancy and loyalty filters', () => {
    expect(parseGuestDirectoryFilter('in_house')).toBe('in_house')
    expect(parseGuestDirectoryFilter('departed')).toBe('departed')
    expect(parseGuestDirectoryFilter('vip')).toBe('vip')
    expect(parseGuestDirectoryFilter('bogus')).toBeNull()
  })
})

describe('deriveGuestOccupancy', () => {
  it('does not treat leftover checkout dates as in-house', () => {
    expect(
      deriveGuestOccupancy(
        [stay({ status: 'checked_out', check_out: '2026-08-13' })],
        null,
        '2026-08-01',
        '2026-08-13',
      ),
    ).toBe('departed')
  })

  it('uses reservation status, not guest dates, for current occupancy', () => {
    expect(
      deriveGuestOccupancy(
        [stay({ status: 'checked_in', check_out: '2026-08-20' })],
        null,
        '2026-08-01',
        '2026-08-20',
      ),
    ).toBe('in_house')
    expect(deriveGuestOccupancy([stay({ status: 'overstay' })], null, null, '2026-08-10')).toBe(
      'overstay',
    )
    expect(
      deriveGuestOccupancy([stay({ status: 'checkout_in_progress' })], null, null, null),
    ).toBe('checking_out')
  })

  it('treats a legacy room assignment without a reservation as in-house', () => {
    expect(deriveGuestOccupancy([], 'room-1', '2026-08-01', '2026-08-20')).toBe('in_house')
  })

  it('marks future bookings as upcoming, not past', () => {
    expect(deriveGuestOccupancy([stay({ status: 'confirmed' })], null, null, null)).toBe('upcoming')
  })
})

describe('buildGuestDirectoryFields', () => {
  it('keeps VIP loyalty while the guest is in house', () => {
    const fields = buildGuestDirectoryFields({
      reservations: [
        stay({ status: 'checked_out', total_amount: 2000, check_out: '2026-01-10' }),
        stay({
          id: 'res-2',
          status: 'checked_in',
          total_amount: 4000,
          check_out: '2026-08-20',
        }),
      ],
      guestRoomId: 'room-1',
      guestCheckIn: '2026-08-10',
      guestCheckOut: '2026-08-20',
    })

    expect(fields.occupancy).toBe('in_house')
    expect(fields.isInHouse).toBe(true)
    expect(fields.canCheckOut).toBe(true)
    expect(fields.loyalty).toBe('vip')
    expect(fields.totalStays).toBe(2)
    expect(fields.reservationId).toBe('res-2')
  })

  it('does not count upcoming bookings as completed stays', () => {
    const fields = buildGuestDirectoryFields({
      reservations: [
        stay({ status: 'checked_out', total_amount: 500 }),
        stay({ id: 'res-2', status: 'confirmed', total_amount: 900, check_out: '2026-12-20' }),
      ],
      guestRoomId: null,
      guestCheckIn: '2026-08-01',
      guestCheckOut: '2026-08-13',
    })

    expect(fields.occupancy).toBe('upcoming')
    expect(fields.totalStays).toBe(1)
    expect(fields.loyalty).toBe('new')
    expect(fields.lastStay).toBe('2026-08-13')
  })

  it('ignores voided reservations for spend and occupancy', () => {
    const fields = buildGuestDirectoryFields({
      reservations: [stay({ status: 'cancelled', total_amount: 9000 })],
      guestRoomId: null,
      guestCheckIn: null,
      guestCheckOut: null,
    })

    expect(fields.occupancy).toBe('none')
    expect(fields.totalStays).toBe(0)
    expect(fields.totalSpent).toBe(0)
    expect(fields.loyalty).toBe('new')
    expect(fields.isInHouse).toBe(false)
    expect(fields.canCheckOut).toBe(false)
  })

  it('allows checkout for overstay and checking-out, not dispute hold', () => {
    const overstay = buildGuestDirectoryFields({
      reservations: [stay({ status: 'overstay' })],
      guestRoomId: 'room-1',
      guestCheckIn: '2026-08-01',
      guestCheckOut: '2026-08-10',
    })
    expect(overstay.canCheckOut).toBe(true)
    expect(overstay.isInHouse).toBe(true)

    const dispute = buildGuestDirectoryFields({
      reservations: [stay({ status: 'dispute_hold' })],
      guestRoomId: 'room-1',
      guestCheckIn: '2026-08-01',
      guestCheckOut: '2026-08-13',
    })
    expect(dispute.occupancy).toBe('in_house')
    expect(dispute.isInHouse).toBe(true)
    expect(dispute.canCheckOut).toBe(false)
  })
})

describe('deriveGuestLoyalty', () => {
  it('uses stay count and spend thresholds independently of occupancy', () => {
    expect(deriveGuestLoyalty(1, 0)).toBe('new')
    expect(deriveGuestLoyalty(2, 0)).toBe('returning')
    expect(deriveGuestLoyalty(VIP_STAYS_THRESHOLD, 0)).toBe('vip')
    expect(deriveGuestLoyalty(1, VIP_SPEND_THRESHOLD)).toBe('vip')
  })
})

describe('guestMatchesDirectoryFilter', () => {
  it('filters occupancy and loyalty separately', () => {
    const inHouseVip = guest({
      id: '1',
      name: 'Ama',
      occupancy: 'in_house',
      loyalty: 'vip',
      isInHouse: true,
    })
    const departedNew = guest({
      id: '2',
      name: 'Kofi',
      occupancy: 'departed',
      loyalty: 'new',
      isInHouse: false,
    })

    expect(guestMatchesDirectoryFilter(inHouseVip, 'in_house')).toBe(true)
    expect(guestMatchesDirectoryFilter(inHouseVip, 'vip')).toBe(true)
    expect(guestMatchesDirectoryFilter(inHouseVip, 'departed')).toBe(false)
    expect(guestMatchesDirectoryFilter(departedNew, 'departed')).toBe(true)
    expect(guestMatchesDirectoryFilter(departedNew, 'new')).toBe(true)
    expect(guestMatchesDirectoryFilter(departedNew, 'in_house')).toBe(false)
  })
})

describe('guestRoomLabel', () => {
  it('says checked out when there is no current room', () => {
    expect(guestRoomLabel({ roomNumber: null, occupancy: 'departed' })).toBe('Checked out')
    expect(guestRoomLabel({ roomNumber: '12', occupancy: 'departed' })).toBe('Room 12')
    expect(guestRoomLabel({ roomNumber: null, occupancy: 'in_house' })).toBe('No room assigned')
  })
})

describe('sortGuestDirectory', () => {
  it('lists in-house guests before checked-out guests', () => {
    const sorted = sortGuestDirectory([
      guest({ id: '1', name: 'Zara', isInHouse: false, occupancy: 'departed', lastStay: '2026-06-20' }),
      guest({
        id: '2',
        name: 'Amy',
        isInHouse: true,
        occupancy: 'in_house',
        checkOut: '2026-06-28',
      }),
      guest({ id: '3', name: 'Ben', isInHouse: false, occupancy: 'departed', lastStay: '2026-06-25' }),
      guest({
        id: '4',
        name: 'Cara',
        isInHouse: true,
        occupancy: 'in_house',
        checkOut: '2026-06-26',
      }),
    ])

    expect(sorted.map((g) => g.id)).toEqual(['4', '2', '3', '1'])
  })

  it('lists overstay and checking-out ahead of ordinary in-house', () => {
    const sorted = sortGuestDirectory([
      guest({ id: '1', name: 'A', isInHouse: true, occupancy: 'in_house', checkOut: '2026-08-20' }),
      guest({ id: '2', name: 'B', isInHouse: true, occupancy: 'overstay', checkOut: '2026-08-10' }),
      guest({
        id: '3',
        name: 'C',
        isInHouse: true,
        occupancy: 'checking_out',
        checkOut: '2026-08-13',
      }),
    ])

    expect(sorted.map((g) => g.id)).toEqual(['2', '3', '1'])
  })
})
