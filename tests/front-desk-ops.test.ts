import { describe, expect, it } from 'vitest'
import {
  buildRoomBoardSignals,
  computeExtendedTodayOperations,
  computeFloorSummary,
  countPrepaidArrivals,
  groupRoomsByFloor,
} from '@/lib/data/front-desk-ops'
import { parseOpsDate, shiftOpsDate } from '@/lib/dates/ops-date'
import type { DbRoom, Reservation } from '@/types'

const rooms: DbRoom[] = [
  {
    id: 'r1',
    hotel_id: 'h1',
    number: '601',
    floor: 6,
    category_id: null,
    nightly_rate: 100,
    monthly_rate: null,
    status: 'occupied',
    updated_at: null,
    updated_by: null,
  },
  {
    id: 'r2',
    hotel_id: 'h1',
    number: '602',
    floor: 6,
    category_id: null,
    nightly_rate: 100,
    monthly_rate: null,
    status: 'cleaning',
    updated_at: null,
    updated_by: null,
  },
  {
    id: 'r3',
    hotel_id: 'h1',
    number: '501',
    floor: 5,
    category_id: null,
    nightly_rate: 100,
    monthly_rate: null,
    status: 'available',
    updated_at: null,
    updated_by: null,
  },
]

const reservations: Reservation[] = [
  {
    id: 'res1',
    bookingRef: 'MOJO-A',
    guestId: 'g1',
    guestName: 'Ama',
    guestEmail: '',
    guestPhone: '',
    roomId: 'r1',
    roomNumber: '601',
    propertyId: 'h1',
    checkInDate: '2026-06-15',
    checkOutDate: '2026-06-17',
    status: 'checked_in',
    numberOfNights: 2,
    totalPrice: 200,
    paidAmount: 200,
    folioSubtotal: 0,
    estimatedTotal: 200,
    balanceDue: 0,
    paymentStatus: 'paid',
    depositAmount: 0,
    currency: 'GHS',
    source: 'walk_in',
    channel: 'walk_in',
    rateType: 'nightly',
    nightlyRate: 100,
    monthlyRate: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'res2',
    bookingRef: 'MOJO-B',
    guestId: 'g2',
    guestName: 'Kofi',
    guestEmail: '',
    guestPhone: '',
    roomId: 'r3',
    roomNumber: '501',
    propertyId: 'h1',
    checkInDate: '2026-06-15',
    checkOutDate: '2026-06-16',
    status: 'confirmed',
    numberOfNights: 1,
    totalPrice: 100,
    paidAmount: 50,
    folioSubtotal: 0,
    estimatedTotal: 100,
    balanceDue: 50,
    paymentStatus: 'deposit_paid',
    depositAmount: 50,
    currency: 'GHS',
    source: 'website',
    channel: 'direct',
    rateType: 'nightly',
    nightlyRate: 100,
    monthlyRate: 0,
    createdAt: '',
    updatedAt: '',
  },
]

describe('parseOpsDate', () => {
  it('defaults to today for invalid input', () => {
    expect(parseOpsDate(undefined)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('accepts valid ISO dates', () => {
    expect(parseOpsDate('2026-06-15')).toBe('2026-06-15')
  })

  it('shifts dates', () => {
    expect(shiftOpsDate('2026-06-15', 1)).toBe('2026-06-16')
  })
})

describe('front desk ops', () => {
  it('groups rooms by floor descending', () => {
    const grouped = groupRoomsByFloor(rooms)
    expect(grouped.map((g) => g.floor)).toEqual([6, 5])
    expect(grouped[0].rooms.map((r) => r.number)).toEqual(['601', '602'])
  })

  it('builds room board signals for arrivals and housekeeping', () => {
    const signals = buildRoomBoardSignals(rooms, reservations, '2026-06-15')
    expect(signals.get('r1')?.departureToday).toBe(false)
    expect(signals.get('r2')?.housekeeping).toBe('cleaning')
    expect(signals.get('r3')?.arrivalToday).toBe(true)
    expect(signals.get('r3')?.prepaidArrival).toBe(true)
  })

  it('counts prepaid arrivals', () => {
    expect(countPrepaidArrivals(reservations, '2026-06-15')).toBe(2)
  })

  it('computes extended ops metrics', () => {
    const ops = computeExtendedTodayOperations(rooms, reservations, 2, 3, '2026-06-15')
    expect(ops.guestsInHouse).toBe(2)
    expect(ops.arrivalsToday).toBe(2)
    expect(ops.dirtyRooms).toBe(1)
    expect(ops.guestRequests).toBe(2)
    expect(ops.unreadMessages).toBe(3)
    expect(ops.prepaidArrivals).toBe(2)
    expect(ops.vacantRooms).toBe(1)
  })

  it('summarizes floor counts', () => {
    const signals = buildRoomBoardSignals(rooms, reservations, '2026-06-15')
    const summary = computeFloorSummary(6, rooms.filter((r) => r.floor === 6), signals)
    expect(summary.occupied).toBe(1)
    expect(summary.dirty).toBe(1)
    expect(summary.arrivals).toBe(1)
  })
})
