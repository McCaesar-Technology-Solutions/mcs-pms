import { describe, expect, it } from 'vitest'
import { computeAnalytics } from '@/lib/data/analytics'
import type { KPIMetrics, Reservation } from '@/types'

function reservation(overrides: Partial<Reservation>): Reservation {
  return {
    id: 'r1',
    bookingRef: 'MOJO-R1',
    guestId: 'g1',
    guestName: 'Test Guest',
    guestEmail: '',
    guestPhone: '',
    roomId: 'room1',
    roomNumber: '1',
    propertyId: 'h1',
    checkInDate: '2026-06-01',
    checkOutDate: '2026-06-03',
    status: 'confirmed',
    numberOfNights: 2,
    totalPrice: 200,
    paidAmount: 0,
    currency: 'GHS',
    source: 'walk_in',
    channel: 'walk_in',
    rateType: 'nightly',
    nightlyRate: 100,
    monthlyRate: 0,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

const baseMetrics: KPIMetrics = {
  totalRevenue: 500,
  occupancyRate: 0.5,
  averageNightlyRate: 100,
  totalBookings: 2,
  totalGuests: 2,
  reviParMetric: 250,
}

describe('computeAnalytics', () => {
  it('returns empty-state friendly zeros with no data', () => {
    const result = computeAnalytics({ reservations: [], metrics: { ...baseMetrics, totalRevenue: 0, totalBookings: 0 } })
    expect(result.totalBookings).toBe(0)
    expect(result.weekly).toHaveLength(7)
    expect(result.monthly).toHaveLength(6)
  })

  it('excludes cancelled and no_show from booking counts', () => {
    const result = computeAnalytics({
      reservations: [
        reservation({ id: 'a', status: 'confirmed' }),
        reservation({ id: 'b', status: 'cancelled', guestId: 'g2' }),
        reservation({ id: 'c', status: 'no_show', guestId: 'g3' }),
      ],
      metrics: baseMetrics,
    })
    expect(result.totalBookings).toBe(1)
    expect(result.cancellationRatePct).toBe(33)
  })

  it('computes repeat guest rate', () => {
    const result = computeAnalytics({
      reservations: [
        reservation({ id: 'a', guestId: 'g1' }),
        reservation({ id: 'b', guestId: 'g1', checkInDate: '2026-07-01', checkOutDate: '2026-07-02' }),
        reservation({ id: 'c', guestId: 'g2' }),
      ],
      metrics: baseMetrics,
    })
    expect(result.repeatRatePct).toBe(50)
  })

  it('computes collection rate from invoices', () => {
    const result = computeAnalytics({
      reservations: [reservation({})],
      metrics: baseMetrics,
      invoices: [
        { total_amount: 100, payment_status: 'paid' } as never,
        { total_amount: 100, payment_status: 'pending' } as never,
      ],
    })
    expect(result.collectionRatePct).toBe(50)
  })

  it('passes through channel performance', () => {
    const result = computeAnalytics({
      reservations: [reservation({})],
      metrics: baseMetrics,
      channels: [{ channel: 'walk_in', bookings: 1, revenue: 200 }],
    })
    expect(result.channels).toHaveLength(1)
  })
})
