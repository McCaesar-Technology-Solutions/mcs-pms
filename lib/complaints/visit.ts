/** Display a scheduled visit in Ghana locale. */
export function formatComplaintVisit(at: string | null | undefined): string {
  if (!at) return ''
  return new Date(at).toLocaleString('en-GH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Minimum lead time before a visit can be scheduled. */
export const VISIT_MIN_LEAD_MS = 30 * 60 * 1000

export function parseVisitDateTime(value: string): Date | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function isVisitTimeValid(at: Date, now = Date.now()): boolean {
  return at.getTime() >= now + VISIT_MIN_LEAD_MS
}
