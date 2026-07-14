import { describe, expect, it } from 'vitest'
import {
  bookingRefSearchPrefix,
  isSecuredPaymentStatus,
  parseReservationSearchParams,
} from '@/lib/reservations/search-params'

describe('parseReservationSearchParams', () => {
  it('parses status, payment status, dates, and page', () => {
    const result = parseReservationSearchParams({
      q: ' Ama ',
      status: 'checked_in',
      pay: 'partial',
      checkIn: '2026-07-01',
      checkOut: '2026-07-05',
      payment: 'secured',
      page: '2',
    })

    expect(result.initialSearch).toBe('Ama')
    expect(result.initialStatus).toBe('checked_in')
    expect(result.initialPaymentStatus).toBe('partial')
    expect(result.initialCheckInDate).toBe('2026-07-01')
    expect(result.initialCheckOutDate).toBe('2026-07-05')
    expect(result.initialPaymentSecured).toBe(true)
    expect(result.page).toBe(2)
    expect(result.filters).toMatchObject({
      q: 'Ama',
      status: 'checked_in',
      paymentStatus: 'partial',
      checkInDate: '2026-07-01',
      checkOutDate: '2026-07-05',
      paymentSecured: true,
      page: 2,
      pageSize: 10,
    })
  })

  it('ignores invalid status / date / page values', () => {
    const result = parseReservationSearchParams({
      status: 'not-a-status',
      pay: 'nope',
      checkIn: '07-01-2026',
      page: '0',
    })

    expect(result.initialStatus).toBeUndefined()
    expect(result.initialPaymentStatus).toBeUndefined()
    expect(result.initialCheckInDate).toBeUndefined()
    expect(result.page).toBe(1)
    expect(result.filters.status).toBe('all')
    expect(result.filters.paymentStatus).toBe('all')
  })
})

describe('bookingRefSearchPrefix', () => {
  it('extracts hex prefix from MOJO refs', () => {
    expect(bookingRefSearchPrefix('MOJO-A1B2C3D4')).toBe('a1b2c3d4')
    expect(bookingRefSearchPrefix('a1b2')).toBe('a1b2')
    expect(bookingRefSearchPrefix('guest name')).toBeNull()
  })
})

describe('isSecuredPaymentStatus', () => {
  it('treats paid / deposit / complimentary as secured', () => {
    expect(isSecuredPaymentStatus('paid', 0)).toBe(true)
    expect(isSecuredPaymentStatus('deposit_paid', 0)).toBe(true)
    expect(isSecuredPaymentStatus('complimentary', 0)).toBe(true)
  })

  it('treats partial as secured only with a deposit', () => {
    expect(isSecuredPaymentStatus('partial', 50)).toBe(true)
    expect(isSecuredPaymentStatus('partial', 0)).toBe(false)
    expect(isSecuredPaymentStatus('unpaid', 0)).toBe(false)
  })
})
