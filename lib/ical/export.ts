import {
  INDEFINITE_OCCUPANCY_STATUSES,
  OCCUPANCY_BLOCKING_STATUSES,
} from '@/lib/reservations/lifecycle'

export const ICAL_EXPORT_STATUSES = [
  ...OCCUPANCY_BLOCKING_STATUSES,
  ...INDEFINITE_OCCUPANCY_STATUSES,
] as const

export interface ExportReservationRow {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string | null
  channel: string | null
  ical_uid: string | null
  ical_feed_id: string | null
}

function foldLine(line: string): string {
  // RFC 5545: lines SHOULD NOT be longer than 75 octets.
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let offset = 0
  let first = true
  while (offset < bytes.length) {
    const max = first ? 75 : 74
    let end = Math.min(offset + max, bytes.length)
    // Avoid splitting mid-codepoint
    while (end > offset && (bytes[end]! & 0xc0) === 0x80) end -= 1
    if (end === offset) end = Math.min(offset + max, bytes.length)
    const chunk = bytes.subarray(offset, end).toString('utf8')
    parts.push(first ? chunk : ` ${chunk}`)
    first = false
    offset = end
  }
  return parts.join('\r\n')
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

function formatDateValue(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function utcStamp(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${day}T${hh}${mm}${ss}Z`
}

/**
 * Build an ICS feed for Airbnb "Import calendar".
 * Excludes reservations imported from the paired Airbnb import feed to avoid echo loops.
 */
export function buildAvailabilityIcs(input: {
  calendarName: string
  reservations: ExportReservationRow[]
  excludeImportFeedId?: string | null
  prodId?: string
}): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${input.prodId ?? '-//MOJO Apartments//PMS iCal//EN'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
  ]

  const stamp = utcStamp()

  for (const res of input.reservations) {
    if (input.excludeImportFeedId && res.ical_feed_id === input.excludeImportFeedId) {
      continue
    }
    if (!res.check_in || !res.check_out || res.check_out <= res.check_in) continue

    const uid = res.ical_uid?.trim() || `mojo-${res.id}@mojo-pms`
    const summary =
      res.channel === 'airbnb' && res.guest_name.startsWith('Blocked')
        ? 'Blocked'
        : `Reserved - ${res.guest_name}`

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatDateValue(res.check_in)}`,
      `DTEND;VALUE=DATE:${formatDateValue(res.check_out)}`,
      `SUMMARY:${escapeText(summary.slice(0, 120))}`,
      `DESCRIPTION:${escapeText(`MOJO PMS · ${res.status ?? 'booked'} · ${res.channel ?? 'direct'}`)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ]
    for (const line of eventLines) lines.push(foldLine(line))
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
