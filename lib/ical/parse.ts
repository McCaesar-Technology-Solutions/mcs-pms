/**
 * Minimal RFC 5545 iCalendar parser for OTA calendar sync.
 * Handles folded lines, escaped text, DATE / DATE-TIME, and VEVENT blocks.
 */

export interface IcalDateValue {
  /** YYYY-MM-DD in calendar date terms */
  date: string
  /** True when VALUE=DATE (all-day); DTEND is exclusive per RFC 5545 */
  allDay: boolean
}

export interface IcalEvent {
  uid: string
  dtstart: IcalDateValue
  dtend: IcalDateValue
  summary: string
  description: string
  status: string | null
  raw: Record<string, string>
}

export interface ParseIcsResult {
  events: IcalEvent[]
  prodId: string | null
  calName: string | null
}

function unfoldLines(ics: string): string[] {
  const normalized = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const raw = normalized.split('\n')
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

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parsePropLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':')
  if (colon <= 0) return null
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const parts = left.split(';')
  const name = parts[0]?.toUpperCase() ?? ''
  if (!name) return null
  const params: Record<string, string> = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1)
  }
  return { name, params, value }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** Parse ICS date or date-time into a calendar date (UTC for floating/Z, local digits otherwise). */
export function parseIcalDate(value: string, params: Record<string, string>): IcalDateValue | null {
  const trimmed = value.trim()
  const valueType = (params.VALUE ?? '').toUpperCase()
  const allDayHint = valueType === 'DATE' || (/^\d{8}$/.test(trimmed) && !trimmed.includes('T'))

  if (/^\d{8}$/.test(trimmed)) {
    const y = Number(trimmed.slice(0, 4))
    const m = Number(trimmed.slice(4, 6))
    const d = Number(trimmed.slice(6, 8))
    if (!y || !m || !d) return null
    return { date: ymd(y, m, d), allDay: true }
  }

  const m = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const hh = Number(m[4])
  const mm = Number(m[5])
  const ss = Number(m[6])
  const isUtc = Boolean(m[7])

  if (allDayHint) {
    return { date: ymd(y, mo, d), allDay: true }
  }

  if (isUtc) {
    const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm, ss))
    return {
      date: ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()),
      allDay: false,
    }
  }

  // Floating local date-time — use the calendar date portion (OTA feeds are date-oriented).
  return { date: ymd(y, mo, d), allDay: false }
}

/** Add days to YYYY-MM-DD. */
export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/**
 * Normalize DTSTART/DTEND into PMS check-in / check-out (checkout exclusive).
 * For timed events with equal calendar dates, treat as a 1-night stay.
 */
export function eventStayDates(
  dtstart: IcalDateValue,
  dtend: IcalDateValue | null,
): { checkIn: string; checkOut: string } | null {
  const checkIn = dtstart.date
  let checkOut = dtend?.date ?? addDaysISO(checkIn, 1)

  // Timed end on same calendar day as start → at least one night.
  if (!dtstart.allDay && dtend && !dtend.allDay && checkOut <= checkIn) {
    checkOut = addDaysISO(checkIn, 1)
  }

  // All-day with missing/equal DTEND → one night.
  if (checkOut <= checkIn) {
    checkOut = addDaysISO(checkIn, 1)
  }

  return { checkIn, checkOut }
}

export function parseIcs(ics: string): ParseIcsResult {
  const lines = unfoldLines(ics)
  const events: IcalEvent[] = []
  let prodId: string | null = null
  let calName: string | null = null

  let inEvent = false
  let props: Record<string, { params: Record<string, string>; value: string }> = {}

  const flushEvent = () => {
    const uid = props.UID?.value?.trim()
    const start = props.DTSTART ? parseIcalDate(props.DTSTART.value, props.DTSTART.params) : null
    if (!uid || !start) {
      props = {}
      return
    }
    const end = props.DTEND ? parseIcalDate(props.DTEND.value, props.DTEND.params) : null
    const stay = eventStayDates(start, end)
    if (!stay) {
      props = {}
      return
    }

    // Recompute end value for storage using stay dates.
    const dtend: IcalDateValue = end
      ? { date: stay.checkOut, allDay: end.allDay || start.allDay }
      : { date: stay.checkOut, allDay: true }

    const raw: Record<string, string> = {}
    for (const [k, v] of Object.entries(props)) {
      raw[k] = v.value
    }

    events.push({
      uid: unescapeText(uid),
      dtstart: { date: stay.checkIn, allDay: start.allDay },
      dtend,
      summary: unescapeText(props.SUMMARY?.value ?? '').trim(),
      description: unescapeText(props.DESCRIPTION?.value ?? '').trim(),
      status: props.STATUS?.value?.trim().toUpperCase() ?? null,
      raw,
    })
    props = {}
  }

  for (const line of lines) {
    if (!line || line.startsWith(' ')) continue
    const parsed = parsePropLine(line)
    if (!parsed) continue

    if (parsed.name === 'BEGIN' && parsed.value.toUpperCase() === 'VEVENT') {
      inEvent = true
      props = {}
      continue
    }
    if (parsed.name === 'END' && parsed.value.toUpperCase() === 'VEVENT') {
      if (inEvent) flushEvent()
      inEvent = false
      continue
    }

    if (!inEvent) {
      if (parsed.name === 'PRODID') prodId = unescapeText(parsed.value).trim()
      if (parsed.name === 'X-WR-CALNAME') calName = unescapeText(parsed.value).trim()
      continue
    }

    // First occurrence wins for duplicates (UID etc.).
    if (!props[parsed.name]) {
      props[parsed.name] = { params: parsed.params, value: parsed.value }
    }
  }

  return { events, prodId, calName }
}
