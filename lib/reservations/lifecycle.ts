import type { ReservationStatus } from '@/types'

/** Statuses that block the room on the calendar / availability engine. */
export const OCCUPANCY_BLOCKING_STATUSES = ['confirmed', 'checked_in'] as const

/** Open pipeline — not yet departed (dashboard KPI booking count). */
export const OPEN_BOOKING_STATUSES = ['confirmed', 'checked_in'] as const

/** Count toward historical analytics & channel mix (excludes voided). */
export const METRICS_ELIGIBLE_STATUSES = [
  'confirmed',
  'checked_in',
  'checked_out',
] as const

/** Terminal void — never blocks rooms or counts as active revenue. */
export const VOIDED_RESERVATION_STATUSES = ['cancelled', 'no_show'] as const

export function isOccupancyBlockingStatus(
  status: string | null | undefined,
): status is (typeof OCCUPANCY_BLOCKING_STATUSES)[number] {
  return status === 'confirmed' || status === 'checked_in'
}

export function isOpenBookingStatus(
  status: string | null | undefined,
): status is (typeof OPEN_BOOKING_STATUSES)[number] {
  return status === 'confirmed' || status === 'checked_in'
}

export function isMetricsEligibleStatus(
  status: string | null | undefined,
): status is (typeof METRICS_ELIGIBLE_STATUSES)[number] {
  return (
    status === 'confirmed' || status === 'checked_in' || status === 'checked_out'
  )
}

export function isVoidedReservationStatus(status: string | null | undefined): boolean {
  return status === 'cancelled' || status === 'no_show'
}

export function canCancelReservationStatus(
  status: string | null | undefined,
): status is 'confirmed' {
  return status === 'confirmed'
}

export function filterOpenBookings<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => isOpenBookingStatus(r.status))
}

export function filterMetricsEligible<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => isMetricsEligibleStatus(r.status))
}

export function filterNotVoided<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isVoidedReservationStatus(r.status))
}

/** Normalize DB status for typed comparisons. */
export function asReservationStatus(status: string | null | undefined): ReservationStatus | 'no_show' | null {
  if (!status) return null
  if (
    status === 'confirmed' ||
    status === 'checked_in' ||
    status === 'checked_out' ||
    status === 'cancelled' ||
    status === 'no_show'
  ) {
    return status
  }
  return null
}
