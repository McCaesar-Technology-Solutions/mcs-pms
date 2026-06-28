const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Parse ?opsDate=YYYY-MM-DD or default to today (UTC date slice). */
export function parseOpsDate(value?: string | null, fallback = new Date()): string {
  if (value && ISO_DATE.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    if (!Number.isNaN(parsed.getTime())) return value
  }
  return fallback.toISOString().slice(0, 10)
}

export function formatOpsDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isOpsDateToday(iso: string): boolean {
  return iso === new Date().toISOString().slice(0, 10)
}

/** Shift ops date by N days (for prev/next controls). */
export function shiftOpsDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
