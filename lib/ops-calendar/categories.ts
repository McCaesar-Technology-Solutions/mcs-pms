export const OPS_EVENT_LABELS: Record<string, string> = {
  training: 'Training',
  meeting: 'Meeting',
  guest_service: 'Guest service',
  maintenance: 'Maintenance',
  event: 'Event',
  general: 'General',
}

/** Categories that also post to the Property team staff chat. */
export const IMPORTANT_OPS_CATEGORIES = new Set([
  'training',
  'meeting',
  'guest_service',
  'maintenance',
  'event',
])

export function isImportantOpsCategory(category: string): boolean {
  return IMPORTANT_OPS_CATEGORIES.has(category)
}

export function formatOpsEventWhen(startsAt: string, allDay: boolean): string {
  const start = new Date(startsAt)
  if (allDay) {
    return start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }
  return start.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
