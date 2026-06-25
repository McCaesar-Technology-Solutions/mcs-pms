export interface ParsedICalEvent {
  uid: string
  summary: string
  dtstart: string
  dtend: string
  status?: string
}

/** Unfold RFC 5545 line continuations. */
function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

/** Parse iCal DATE or DATE-TIME into YYYY-MM-DD. */
export function parseICalDate(value: string): string {
  const cleaned = value.trim().split(':').pop() ?? value
  const digits = cleaned.replace(/[^0-9T]/g, '')
  if (digits.length < 8) {
    throw new Error(`Invalid iCal date: ${value}`)
  }
  const y = digits.slice(0, 4)
  const m = digits.slice(4, 6)
  const d = digits.slice(6, 8)
  return `${y}-${m}-${d}`
}

export function parseICalEvents(icalText: string): ParsedICalEvent[] {
  const lines = unfoldLines(icalText)
  const events: ParsedICalEvent[] = []
  let inEvent = false
  let current: Partial<ParsedICalEvent> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false
      if (current.uid && current.dtstart && current.dtend) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? 'OTA Guest',
          dtstart: current.dtstart,
          dtend: current.dtend,
          status: current.status,
        })
      }
      continue
    }
    if (!inEvent) continue

    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const keyPart = trimmed.slice(0, colon)
    const value = trimmed.slice(colon + 1)
    const key = keyPart.split(';')[0].toUpperCase()

    switch (key) {
      case 'UID':
        current.uid = value.trim()
        break
      case 'SUMMARY':
        current.summary = value.trim()
        break
      case 'DTSTART':
        current.dtstart = parseICalDate(value)
        break
      case 'DTEND':
        current.dtend = parseICalDate(value)
        break
      case 'STATUS':
        current.status = value.trim().toUpperCase()
        break
      default:
        break
    }
  }

  return events
}
