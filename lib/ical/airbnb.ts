import type { IcalEvent } from '@/lib/ical/parse'
import { eventStayDates } from '@/lib/ical/parse'

export type AirbnbEventKind = 'reservation' | 'block' | 'cancelled'

export interface AirbnbMappedEvent {
  uid: string
  kind: AirbnbEventKind
  checkIn: string
  checkOut: string
  guestName: string
  summary: string
  description: string
  reservationUrl: string | null
}

const BLOCK_SUMMARY =
  /^(not available|unavailable|blocked|block|busy|closed|owner block|maintenance)/i
const RESERVED_SUMMARY = /^(reserved|reservation|booked|accepted)/i
const CANCELLED_STATUS = /^(CANCELLED|CANCELED)$/i

function extractAirbnbReservationUrl(description: string): string | null {
  const match = description.match(
    /https?:\/\/(?:www\.)?airbnb\.[^\s\\]+\/(?:hosting\/)?reservations\/details\/[A-Za-z0-9_-]+/i,
  )
  return match?.[0] ?? null
}

function shortUid(uid: string): string {
  const compact = uid.replace(/@.*/, '').replace(/[^a-zA-Z0-9]/g, '')
  return compact.slice(0, 8) || uid.slice(0, 8)
}

export function classifyAirbnbEvent(event: IcalEvent): AirbnbEventKind {
  if (event.status && CANCELLED_STATUS.test(event.status)) return 'cancelled'

  const summary = event.summary.trim()
  const description = event.description

  if (BLOCK_SUMMARY.test(summary)) return 'block'
  if (RESERVED_SUMMARY.test(summary)) return 'reservation'
  if (extractAirbnbReservationUrl(description)) return 'reservation'
  if (/reservation/i.test(description) && /airbnb/i.test(description)) return 'reservation'

  // Airbnb often uses guest names as SUMMARY for confirmed stays.
  if (summary.length >= 2 && !/^airbnb$/i.test(summary)) return 'reservation'

  return 'block'
}

export function guestNameForAirbnbEvent(event: IcalEvent, kind: AirbnbEventKind): string {
  if (kind === 'block') return 'Blocked (Airbnb)'
  if (kind === 'cancelled') return 'Cancelled (Airbnb)'

  const summary = event.summary.trim()
  if (summary && !RESERVED_SUMMARY.test(summary) && !BLOCK_SUMMARY.test(summary)) {
    return summary.slice(0, 120)
  }
  return `Airbnb guest (${shortUid(event.uid)})`
}

export function mapAirbnbEvent(event: IcalEvent): AirbnbMappedEvent | null {
  const stay = eventStayDates(event.dtstart, event.dtend)
  if (!stay) return null

  const kind = classifyAirbnbEvent(event)
  return {
    uid: event.uid,
    kind,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guestName: guestNameForAirbnbEvent(event, kind),
    summary: event.summary,
    description: event.description,
    reservationUrl: extractAirbnbReservationUrl(event.description),
  }
}

export function mapAirbnbEvents(events: IcalEvent[]): AirbnbMappedEvent[] {
  const byUid = new Map<string, AirbnbMappedEvent>()
  for (const event of events) {
    const mapped = mapAirbnbEvent(event)
    if (!mapped) continue
    // Last occurrence wins if duplicates appear in a feed.
    byUid.set(mapped.uid, mapped)
  }
  return [...byUid.values()]
}
