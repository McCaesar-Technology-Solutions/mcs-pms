import type { GuestRow } from '@/lib/data/guests'

/** Stable guest reference for exports and clipboard (matches reservation ref style). */
export function guestRef(guest: GuestRow): string {
  if (guest.reservationId) {
    return `MOJO-${guest.reservationId.slice(0, 8).toUpperCase()}`
  }
  return `GUEST-${guest.id.slice(0, 8).toUpperCase()}`
}
