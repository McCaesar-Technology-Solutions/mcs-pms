import {
  isOccupyingReservationStatus,
  OCCUPYING_STATUSES,
} from '@/lib/reservations/lifecycle'
import type { ReservationListFilters, ReservationStatusFilter } from '@/lib/reservations/search-params'

/** `checked_in` / `in_house` mean everyone currently occupying a room, not only exact checked-in. */
export function reservationStatusFilterValues(
  status: ReservationStatusFilter | undefined,
): readonly string[] | null {
  if (!status || status === 'all') return null
  if (status === 'checked_in') return OCCUPYING_STATUSES
  return [status]
}

export function shouldPinOccupyingStays(filters: Pick<
  ReservationListFilters,
  'status' | 'checkInDate' | 'checkOutDate'
>): boolean {
  const status = filters.status ?? 'all'
  return status === 'all' && !filters.checkInDate && !filters.checkOutDate
}

export function occupyingStatusesInFilter(): string {
  return `(${OCCUPYING_STATUSES.join(',')})`
}

/** Occupying first (soonest departure), then everyone else by newest check-in. */
export function compareDeskReservationList(
  a: { status: string; checkIn: string; checkOut: string },
  b: { status: string; checkIn: string; checkOut: string },
): number {
  const aOcc = isOccupyingReservationStatus(a.status)
  const bOcc = isOccupyingReservationStatus(b.status)
  if (aOcc !== bOcc) return aOcc ? -1 : 1
  if (aOcc) {
    return a.checkOut.localeCompare(b.checkOut) || a.checkIn.localeCompare(b.checkIn)
  }
  return b.checkIn.localeCompare(a.checkIn)
}
