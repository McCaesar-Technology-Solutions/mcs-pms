import type { ReservationActorRole, ReservationStatus } from '@/types'

/** Statuses that block room inventory on the calendar (real, dated windows). */
export const OCCUPANCY_BLOCKING_STATUSES = [
  'provisional',
  'confirmed',
  'pre_arrival',
  'checked_in',
  'checkout_in_progress',
] as const satisfies readonly ReservationStatus[]

/**
 * Statuses where a guest is still physically holding the room even though the
 * stored check_out date has passed. These must block the room from today
 * onward regardless of their stale dates, so a new booking is never accepted
 * for a room someone has not actually left.
 */
export const INDEFINITE_OCCUPANCY_STATUSES = [
  'overstay',
  'dispute_hold',
] as const satisfies readonly ReservationStatus[]

/** In-house statuses that still hold the room after a missed departure day. */
export const STALE_IN_HOUSE_STATUSES = [
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

/**
 * Guest is physically in-house (Guests-card checkout path).
 * Dispute hold occupies the room but checkout runs from Reservations.
 */
export const IN_HOUSE_STATUSES = [
  'checked_in',
  'checkout_in_progress',
  'overstay',
] as const satisfies readonly ReservationStatus[]

/** In-house plus dispute hold — still occupying a room. */
export const OCCUPYING_STATUSES = [
  ...IN_HOUSE_STATUSES,
  'dispute_hold',
] as const satisfies readonly ReservationStatus[]

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
  | 'dispute_hold'
  | 'release_dispute_hold'
  | 'release_no_show_room'

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

export function isInHouseReservationStatus(status: string | null | undefined): boolean {
  return (IN_HOUSE_STATUSES as readonly string[]).includes(status ?? '')
}

export function isOccupyingReservationStatus(status: string | null | undefined): boolean {
  return (OCCUPYING_STATUSES as readonly string[]).includes(status ?? '')
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

/** Front desk may add nights for these occupying stays. */
export const EXTENDABLE_STATUSES = [
  'checked_in',
  'overstay',
  'checkout_in_progress',
] as const satisfies readonly ReservationStatus[]

export function canExtendStay(status: string | null | undefined): boolean {
  return (EXTENDABLE_STATUSES as readonly string[]).includes(status ?? '')
}

export function canMoveStayRoom(status: string | null | undefined): boolean {
  return canExtendStay(status)
}

/** After extra nights are booked, restore a live in-house status from the new date. */
export function statusAfterStayExtension(
  newCheckOut: string,
  today: string,
): 'checked_in' | 'overstay' {
  return newCheckOut > today ? 'checked_in' : 'overstay'
}

export function stayExtensionChangesStatus(
  fromStatus: string | null | undefined,
  nextStatus: 'checked_in' | 'overstay',
): boolean {
  return fromStatus !== nextStatus
}

/** After a billing dispute is released, resume as in-house or overstay from the stay dates. */
export function statusAfterDisputeHoldRelease(
  checkOut: string,
  today: string,
): 'checked_in' | 'overstay' {
  return checkOut > today ? 'checked_in' : 'overstay'
}

export function canStartDisputeHold(status: string | null | undefined): boolean {
  return status === 'checked_in' || status === 'overstay' || status === 'checkout_in_progress'
}

export const STAY_NOTE_MIN_LENGTH = 3
export const STAY_NOTE_MAX_LENGTH = 200

export function parseRequiredStayNote(
  note: string,
  emptyMessage = 'Add a short note.',
): { ok: true; note: string } | { ok: false; error: string } {
  const trimmed = note.trim()
  if (trimmed.length < STAY_NOTE_MIN_LENGTH) return { ok: false, error: emptyMessage }
  if (trimmed.length > STAY_NOTE_MAX_LENGTH) return { ok: false, error: 'Note is too long.' }
  return { ok: true, note: trimmed }
}

export function canCancelReservationStatus(status: string | null | undefined): boolean {
  return (
    status === 'confirmed' ||
    status === 'pre_arrival' ||
    status === 'provisional' ||
    status === 'inquiry'
  )
}

export function reservationStatusLabel(status: string | null | undefined): string {
  if (status === 'checked_in') return 'In house'
  if (status === 'checkout_in_progress') return 'Checking out'
  if (status === 'overstay') return 'Overstay'
  if (status === 'dispute_hold') return 'Dispute hold'
  if (!status) return ''
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
      if (role === 'manager') actions.push('dispute_hold')
      break
    case 'overstay':
      actions.push(
        'begin_checkout',
        'extend_stay',
        'change_room',
        'approve_late_checkout',
        'record_walkout',
      )
      if (role === 'manager') actions.push('dispute_hold')
      break
    case 'dispute_hold':
      if (role === 'manager') {
        actions.push('release_dispute_hold', 'begin_checkout', 'record_walkout')
      }
      break
    case 'no_show':
      if (role !== 'guest') actions.push('release_no_show_room')
      break
    case 'checkout_in_progress':
      actions.push('complete_checkout', 'extend_stay', 'change_room', 'record_walkout')
      if (role === 'manager') actions.push('dispute_hold')
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
