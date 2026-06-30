import type { ReservationActorRole, ReservationStatus } from '@/types'

/** Statuses that block room inventory on the calendar. */
export const OCCUPANCY_BLOCKING_STATUSES = [
  'provisional',
  'confirmed',
  'pre_arrival',
  'checked_in',
  'checkout_in_progress',
] as const satisfies readonly ReservationStatus[]

/** Statuses that have released inventory. */
export const VOIDED_RESERVATION_STATUSES = ['cancelled', 'no_show', 'released'] as const

/** Active pipeline — front desk view. */
export const OPEN_BOOKING_STATUSES = [
  'provisional',
  'confirmed',
  'pre_arrival',
  'checked_in',
  'checkout_in_progress',
] as const

/** Today's arrivals. */
export const ARRIVING_STATUSES = ['confirmed', 'pre_arrival'] as const

/** Today's departures. */
export const DEPARTING_STATUSES = ['checked_in', 'overstay', 'checkout_in_progress'] as const

/** Read-only / historical. */
export const HISTORICAL_STATUSES = ['checked_out', 'post_stay', 'archived'] as const

/** Count toward historical analytics & channel mix (excludes voided). */
export const METRICS_ELIGIBLE_STATUSES = [
  'confirmed',
  'pre_arrival',
  'checked_in',
  'checkout_in_progress',
  'checked_out',
  'post_stay',
  'archived',
  'overstay',
] as const

export type ReservationAction =
  | 'confirm'
  | 'cancel_hold'
  | 'check_in'
  | 'cancel'
  | 'mark_no_show'
  | 'begin_checkout'
  | 'extend_stay'
  | 'change_room'
  | 'approve_late_checkout'
  | 'complete_checkout'
  | 'record_walkout'

const EDITABLE_STATUSES: ReservationStatus[] = [
  'inquiry',
  'provisional',
  'confirmed',
  'pre_arrival',
]

export function isOccupancyBlockingStatus(
  status: string | null | undefined,
): status is (typeof OCCUPANCY_BLOCKING_STATUSES)[number] {
  return (OCCUPANCY_BLOCKING_STATUSES as readonly string[]).includes(status ?? '')
}

export function isOpenBookingStatus(
  status: string | null | undefined,
): status is (typeof OPEN_BOOKING_STATUSES)[number] {
  return (OPEN_BOOKING_STATUSES as readonly string[]).includes(status ?? '')
}

export function isMetricsEligibleStatus(
  status: string | null | undefined,
): status is (typeof METRICS_ELIGIBLE_STATUSES)[number] {
  return (METRICS_ELIGIBLE_STATUSES as readonly string[]).includes(status ?? '')
}

export function isVoidedReservationStatus(status: string | null | undefined): boolean {
  return (VOIDED_RESERVATION_STATUSES as readonly string[]).includes(status ?? '')
}

export function isHistorical(status: string | null | undefined): boolean {
  return (HISTORICAL_STATUSES as readonly string[]).includes(status ?? '')
}

export function canCheckIn(status: string | null | undefined): boolean {
  return status === 'confirmed' || status === 'pre_arrival'
}

export function canCheckOut(status: string | null | undefined): boolean {
  return status === 'checked_in' || status === 'overstay'
}

export function canCancelReservationStatus(status: string | null | undefined): boolean {
  return (
    status === 'confirmed' ||
    status === 'pre_arrival' ||
    status === 'provisional' ||
    status === 'inquiry'
  )
}

export function canUpdateReservationFields(status: string | null | undefined): boolean {
  return EDITABLE_STATUSES.includes(status as ReservationStatus)
}

export function getAvailableActions(
  status: string | null | undefined,
  actorRole: ReservationActorRole | string,
): ReservationAction[] {
  const role = actorRole === 'owner' ? 'manager' : actorRole
  const actions: ReservationAction[] = []

  switch (status) {
    case 'provisional':
      actions.push('confirm', 'cancel_hold')
      break
    case 'confirmed':
      if (role !== 'guest') actions.push('check_in', 'cancel', 'mark_no_show')
      break
    case 'pre_arrival':
      if (role !== 'guest') actions.push('check_in', 'mark_no_show', 'cancel')
      break
    case 'checked_in':
      actions.push('begin_checkout', 'extend_stay', 'change_room', 'record_walkout')
      break
    case 'overstay':
      actions.push('begin_checkout', 'approve_late_checkout', 'record_walkout')
      break
    case 'checkout_in_progress':
      actions.push('complete_checkout', 'record_walkout')
      break
    default:
      break
  }

  return actions
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

export function asReservationStatus(
  status: string | null | undefined,
): ReservationStatus | null {
  const all: ReservationStatus[] = [
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
  if (!status) return null
  return all.includes(status as ReservationStatus) ? (status as ReservationStatus) : null
}
