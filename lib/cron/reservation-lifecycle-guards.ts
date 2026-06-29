export interface ReservationEventRow {
  event_type: string
  created_at: string
}

/** Skip no-show when guest is checked in on any other reservation at the hotel. */
export function guestInHouseOnOtherReservation(
  otherCheckedInGuestIds: string[],
  guestId: string | null,
): boolean {
  if (!guestId) return false
  return otherCheckedInGuestIds.includes(guestId)
}

/** Skip no-show when OTA sent cancellation in the last 2 hours. */
export function hasRecentOtaCancellation(
  events: ReservationEventRow[],
  now = new Date(),
): boolean {
  const cutoff = now.getTime() - 2 * 60 * 60 * 1000
  return events.some((e) => {
    if (!['ota_cancellation_received', 'channel_cancelled'].includes(e.event_type)) {
      return false
    }
    return new Date(e.created_at).getTime() >= cutoff
  })
}

export function hasLateCheckoutApproval(events: ReservationEventRow[]): boolean {
  return events.some((e) => e.event_type === 'late_checkout_approved')
}

export function hasCheckoutInitiated(events: ReservationEventRow[]): boolean {
  return events.some((e) => e.event_type === 'checkout_initiated')
}

export function shouldMarkOverstay(input: {
  status: string
  departureDate: string
  today: string
  pastCheckoutTime: boolean
  events: ReservationEventRow[]
}): boolean {
  if (input.status !== 'checked_in') return false
  if (input.departureDate !== input.today) return false
  if (!input.pastCheckoutTime) return false
  if (hasLateCheckoutApproval(input.events)) return false
  if (hasCheckoutInitiated(input.events)) return false
  return true
}

export function shouldAutoCheckoutPrompt(input: {
  status: string
  departureDate: string
  today: string
  pastCheckoutTime: boolean
  events: ReservationEventRow[]
}): boolean {
  if (input.status !== 'checked_in') return false
  if (input.departureDate !== input.today) return false
  if (!input.pastCheckoutTime) return false
  if (hasCheckoutInitiated(input.events)) return false
  return true
}
