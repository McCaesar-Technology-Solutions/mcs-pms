/** Pure date rules for go-live / already-in-house guest registration. */

export function validateInHouseEnrollmentDates(
  checkIn: string,
  checkOut: string,
  today: string,
): { ok: true } | { ok: false; error: string } {
  if (checkOut <= checkIn) {
    return { ok: false, error: 'Departure must be after arrival.' }
  }
  if (checkIn > today) {
    return {
      ok: false,
      error: 'Arrival must be today or earlier — use Check in now for future arrivals.',
    }
  }
  if (checkOut <= today) {
    return {
      ok: false,
      error: 'Departure must be after today — this guest is no longer in house.',
    }
  }
  return { ok: true }
}
