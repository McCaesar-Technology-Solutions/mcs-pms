import { describe, expect, it } from 'vitest'
import {
  canCancelReservationStatus,
  filterMetricsEligible,
  filterOpenBookings,
  isMetricsEligibleStatus,
  isOccupancyBlockingStatus,
  isOpenBookingStatus,
  isVoidedReservationStatus,
} from '@/lib/reservations/lifecycle'
import {
  actorMeetsRequiredRole,
  ALLOWED_TRANSITIONS,
  getTransitionDef,
} from '@/lib/reservations/transitions'
import type { ReservationStatus } from '@/types'

describe('reservation lifecycle groupings', () => {
  it('blocks occupancy for provisional through checkout_in_progress', () => {
    expect(isOccupancyBlockingStatus('provisional')).toBe(true)
    expect(isOccupancyBlockingStatus('confirmed')).toBe(true)
    expect(isOccupancyBlockingStatus('pre_arrival')).toBe(true)
    expect(isOccupancyBlockingStatus('checked_in')).toBe(true)
    expect(isOccupancyBlockingStatus('checkout_in_progress')).toBe(true)
    expect(isOccupancyBlockingStatus('checked_out')).toBe(false)
    expect(isOccupancyBlockingStatus('cancelled')).toBe(false)
    expect(isOccupancyBlockingStatus('no_show')).toBe(false)
    expect(isOccupancyBlockingStatus('released')).toBe(false)
  })

  it('treats cancelled, no_show, and released as void', () => {
    expect(isVoidedReservationStatus('cancelled')).toBe(true)
    expect(isVoidedReservationStatus('no_show')).toBe(true)
    expect(isVoidedReservationStatus('released')).toBe(true)
    expect(isVoidedReservationStatus('confirmed')).toBe(false)
  })

  it('allows cancellation from pipeline statuses before check-in', () => {
    expect(canCancelReservationStatus('inquiry')).toBe(true)
    expect(canCancelReservationStatus('provisional')).toBe(true)
    expect(canCancelReservationStatus('confirmed')).toBe(true)
    expect(canCancelReservationStatus('pre_arrival')).toBe(true)
    expect(canCancelReservationStatus('checked_in')).toBe(false)
    expect(canCancelReservationStatus('checked_out')).toBe(false)
  })

  it('filters metrics and open bookings', () => {
    const rows = [
      { id: '1', status: 'confirmed' },
      { id: '2', status: 'no_show' },
      { id: '3', status: 'checked_out' },
      { id: '4', status: 'cancelled' },
      { id: '5', status: 'provisional' },
    ]
    expect(filterMetricsEligible(rows).map((r) => r.id)).toEqual(['1', '3'])
    expect(filterOpenBookings(rows).map((r) => r.id)).toEqual(['1', '5'])
    expect(isMetricsEligibleStatus('no_show')).toBe(false)
    expect(isOpenBookingStatus('checked_out')).toBe(false)
  })
})

describe('reservation transition table', () => {
  const allStatuses: ReservationStatus[] = [
    'inquiry',
    'provisional',
    'confirmed',
    'pre_arrival',
    'checked_in',
    'checkout_in_progress',
    'checked_out',
    'post_stay',
    'archived',
    'no_show',
    'cancelled',
    'released',
    'dispute_hold',
    'overstay',
    'walkout',
  ]

  it('defines every spec transition', () => {
    expect(getTransitionDef('inquiry', 'provisional')?.eventType).toBe('hold_requested')
    expect(getTransitionDef('confirmed', 'checked_in')?.eventType).toBe('checked_in')
    expect(getTransitionDef('checked_out', 'post_stay')?.eventType).toBe('post_stay_started')
    expect(getTransitionDef('checked_in', 'checkout_in_progress')?.eventType).toBe('checkout_initiated')
  })

  it('rejects undefined transitions', () => {
    expect(getTransitionDef('archived', 'confirmed')).toBeNull()
    expect(getTransitionDef('checked_out', 'checked_in')).toBeNull()
  })

  it('enforces role requirements', () => {
    const checkIn = getTransitionDef('confirmed', 'checked_in')!
    expect(actorMeetsRequiredRole('staff', checkIn.requiredRole)).toBe(true)
    expect(actorMeetsRequiredRole('guest', checkIn.requiredRole)).toBe(false)
    expect(actorMeetsRequiredRole('system', checkIn.requiredRole, true)).toBe(true)
  })

  it('has no orphan keys outside known statuses', () => {
    for (const from of Object.keys(ALLOWED_TRANSITIONS)) {
      expect(allStatuses).toContain(from)
      for (const to of Object.keys(ALLOWED_TRANSITIONS[from as ReservationStatus] ?? {})) {
        expect(allStatuses).toContain(to)
      }
    }
  })
})
