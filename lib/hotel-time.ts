import { parseHotelTimeToMinutes } from '@/lib/reservations/check-out-time'

export const DEFAULT_HOTEL_TIMEZONE = 'Africa/Accra'

/** Valid IANA timezone or fallback for invalid values. */
export function normalizeHotelTimezone(value: string | null | undefined): string {
  const tz = (value ?? DEFAULT_HOTEL_TIMEZONE).trim() || DEFAULT_HOTEL_TIMEZONE
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_HOTEL_TIMEZONE
  }
}

/** YYYY-MM-DD in the property timezone. */
export function hotelTodayISO(timezone: string, now = new Date()): string {
  const tz = normalizeHotelTimezone(timezone)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Minutes from local midnight in the property timezone. */
export function hotelLocalMinutes(timezone: string, now = new Date()): number {
  const tz = normalizeHotelTimezone(timezone)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export function isPastHotelLocalTime(
  timezone: string,
  timeText: string | null | undefined,
  now = new Date(),
): boolean {
  const threshold = parseHotelTimeToMinutes(timeText)
  return hotelLocalMinutes(timezone, now) >= threshold
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Calendar date `YYYY-MM-DD` that actually exists. */
export function isIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}
