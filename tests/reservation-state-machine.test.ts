import { describe, expect, it } from 'vitest'
import {
  canCancelReservationStatus,
  canExtendStay,
  canStartDisputeHold,
  filterMetricsEligible,
  filterOpenBookings,
  getAvailableActions,
  isMetricsEligibleStatus,
  isOccupancyBlockingStatus,
  isOpenBookingStatus,
  isVoidedReservationStatus,
  isInHouseReservationStatus,
  isOccupyingReservationStatus,
  parseRequiredStayNote,
  statusAfterDisputeHoldRelease,
  statusAfterStayExtension,
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

  it('treats checked_in, checkout_in_progress, and overstay as in-house', () => {
    expect(isInHouseReservationStatus('checked_in')).toBe(true)
    expect(isInHouseReservationStatus('checkout_in_progress')).toBe(true)
    expect(isInHouseReservationStatus('overstay')).toBe(true)
    expect(isInHouseReservationStatus('dispute_hold')).toBe(false)
    expect(isInHouseReservationStatus('checked_out')).toBe(false)
    expect(isInHouseReservationStatus('post_stay')).toBe(false)
  })

  it('treats dispute hold as occupying but not a Guests-card checkout path', () => {
    expect(isOccupyingReservationStatus('checked_in')).toBe(true)
    expect(isOccupyingReservationStatus('overstay')).toBe(true)
    expect(isOccupyingReservationStatus('checkout_in_progress')).toBe(true)
    expect(isOccupyingReservationStatus('dispute_hold')).toBe(true)
    expect(isOccupyingReservationStatus('confirmed')).toBe(false)
    expect(isOccupyingReservationStatus('checked_out')).toBe(false)
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

describe('dispute hold', () => {
  it('resumes as in-house when check-out is still in the future', () => {
    expect(statusAfterDisputeHoldRelease('2026-08-20', '2026-08-16')).toBe('checked_in')
  })

  it('resumes as overstay when check-out is today or past', () => {
    expect(statusAfterDisputeHoldRelease('2026-08-16', '2026-08-16')).toBe('overstay')
    expect(statusAfterDisputeHoldRelease('2026-08-14', '2026-08-16')).toBe('overstay')
  })

  it('lets managers release, check out, or walk out; reception cannot', () => {
    expect(getAvailableActions('dispute_hold', 'manager')).toEqual([
      'release_dispute_hold',
      'begin_checkout',
      'record_walkout',
    ])
    expect(getAvailableActions('dispute_hold', 'owner')).toEqual([
      'release_dispute_hold',
      'begin_checkout',
      'record_walkout',
    ])
    expect(getAvailableActions('dispute_hold', 'staff')).toEqual([])
    expect(getAvailableActions('dispute_hold', 'receptionist')).toEqual([])
  })

  it('lets manager, owner, and reception extend overstay and checkout-in-progress stays', () => {
    for (const role of ['manager', 'owner', 'receptionist', 'staff'] as const) {
      expect(getAvailableActions('overstay', role)).toContain('extend_stay')
      expect(getAvailableActions('checkout_in_progress', role)).toContain('extend_stay')
      expect(getAvailableActions('checked_in', role)).toContain('extend_stay')
    }
    expect(canExtendStay('checked_in')).toBe(true)
    expect(canExtendStay('overstay')).toBe(true)
    expect(canExtendStay('checkout_in_progress')).toBe(true)
    expect(canExtendStay('dispute_hold')).toBe(false)
    expect(statusAfterStayExtension('2026-08-21', '2026-08-20')).toBe('checked_in')
    expect(statusAfterStayExtension('2026-08-20', '2026-08-20')).toBe('overstay')
  })

  it('lets managers start a hold from in-house or checkout in progress', () => {
    expect(canStartDisputeHold('checked_in')).toBe(true)
    expect(canStartDisputeHold('overstay')).toBe(true)
    expect(canStartDisputeHold('checkout_in_progress')).toBe(true)
    expect(canStartDisputeHold('dispute_hold')).toBe(false)
    expect(getAvailableActions('checkout_in_progress', 'manager')).toContain('dispute_hold')
    expect(getAvailableActions('checkout_in_progress', 'owner')).toContain('dispute_hold')
    expect(getAvailableActions('checkout_in_progress', 'receptionist')).not.toContain('dispute_hold')
  })

  it('requires a short reason or resolution note', () => {
    expect(parseRequiredStayNote('  ').ok).toBe(false)
    expect(parseRequiredStayNote('ab').ok).toBe(false)
    expect(parseRequiredStayNote('Guest disputes minibar').ok).toBe(true)
    expect(parseRequiredStayNote('x'.repeat(201)).ok).toBe(false)
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
    expect(getTransitionDef('confirmed', 'no_show')?.eventType).toBe('marked_no_show')
    expect(getTransitionDef('confirmed', 'no_show')?.requiredRole).toBe('staff')
    expect(getTransitionDef('checked_in', 'walkout')?.eventType).toBe('walkout_detected')
    expect(getTransitionDef('checked_in', 'dispute_hold')?.eventType).toBe('dispute_hold_started')
    expect(getTransitionDef('checkout_in_progress', 'dispute_hold')?.eventType).toBe('dispute_hold_started')
    expect(getTransitionDef('checkout_in_progress', 'dispute_hold')?.requiredRole).toBe('manager')
    expect(getTransitionDef('dispute_hold', 'checkout_in_progress')?.eventType).toBe('checkout_initiated')
    expect(getTransitionDef('dispute_hold', 'checked_in')?.eventType).toBe('dispute_hold_released')
    expect(getTransitionDef('dispute_hold', 'overstay')?.eventType).toBe('dispute_hold_released')
    expect(getTransitionDef('dispute_hold', 'checked_in')?.requiredRole).toBe('manager')
    expect(getTransitionDef('overstay', 'walkout')?.requiredRole).toBe('staff')
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
