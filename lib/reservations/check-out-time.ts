/** Parse hotel text time (e.g. "11:00 AM", "23:59") into minutes from midnight UTC for a given date. */
export function parseHotelTimeToMinutes(value: string | null | undefined): number {
  const raw = (value ?? '11:00 AM').trim()
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let hours = Number(ampm[1])
    const minutes = Number(ampm[2])
    const meridiem = ampm[3]!.toUpperCase()
    if (meridiem === 'PM' && hours < 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
  }
  const h24 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (h24) {
    return Number(h24[1]) * 60 + Number(h24[2])
  }
  return 11 * 60
}

export function isPastHotelCheckoutTime(
  checkoutTimeText: string | null | undefined,
  now = new Date(),
): boolean {
  const minutes = parseHotelTimeToMinutes(checkoutTimeText)
  const localMinutes = now.getHours() * 60 + now.getMinutes()
  return localMinutes >= minutes
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
