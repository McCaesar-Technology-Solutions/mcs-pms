export interface ICalExportEvent {
  uid: string
  summary: string
  dtstart: string
  dtend: string
}

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatIcalDate(date: string): string {
  return date.replace(/-/g, '')
}

export function generateICalFeed(options: {
  name: string
  events: ICalExportEvent[]
}): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MOJO APARTMENTS//PMS//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcalText(options.name)}`,
  ]

  for (const event of options.events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatIcalDate(event.dtstart)}`,
      `DTEND;VALUE=DATE:${formatIcalDate(event.dtend)}`,
      `SUMMARY:${escapeIcalText(event.summary)}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
