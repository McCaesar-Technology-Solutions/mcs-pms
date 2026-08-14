/** Product column text for stay invoices: `Deluxe · Room 12 (3 nights)`. */
export function invoiceProductLabel(input: {
  roomNumber?: string | null
  nights?: number | null
  roomCategoryName?: string | null
}): string {
  const nights = input.nights ?? 1
  const room = input.roomNumber ? `Room ${input.roomNumber}` : 'Accommodation'
  let stay: string
  if (nights >= 28) {
    const months = Math.max(1, Math.round(nights / 30))
    stay = `${room} (${months === 1 ? 'One month' : `${months} months`})`
  } else if (nights === 7) {
    stay = `${room} (One week)`
  } else {
    stay = `${room} (${nights} night${nights === 1 ? '' : 's'})`
  }
  const category = input.roomCategoryName?.trim()
  return category ? `${category} · ${stay}` : stay
}
