import { describe, expect, it } from 'vitest'
import { addDaysISO, eventStayDates, parseIcalDate, parseIcs } from '@/lib/ical/parse'
import { classifyAirbnbEvent, mapAirbnbEvents } from '@/lib/ical/airbnb'
import { buildSyncPlan } from '@/lib/ical/sync-plan'
import { buildAvailabilityIcs } from '@/lib/ical/export'

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN
X-WR-CALNAME:Listing
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260810
DTEND;VALUE=DATE:20260814
UID:booking-abc123@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC123
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260820
DTEND;VALUE=DATE:20260822
UID:block-xyz@airbnb.com
SUMMARY:Not available
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260901
DTEND;VALUE=DATE:20260905
UID:guest-name@airbnb.com
SUMMARY:Ama Mensah
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMGUEST1
END:VEVENT
END:VCALENDAR`

describe('parseIcs', () => {
  it('parses Airbnb-style all-day events with exclusive DTEND', () => {
    const parsed = parseIcs(SAMPLE_ICS)
    expect(parsed.events).toHaveLength(3)
    expect(parsed.events[0]?.uid).toBe('booking-abc123@airbnb.com')
    expect(parsed.events[0]?.dtstart.date).toBe('2026-08-10')
    expect(parsed.events[0]?.dtend.date).toBe('2026-08-14')
  })

  it('unfolds folded lines', () => {
    const folded = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:fold@test
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
SUMMARY:Hello
  world
END:VEVENT
END:VCALENDAR`
    const parsed = parseIcs(folded)
    expect(parsed.events[0]?.summary).toBe('Hello world')
  })

  it('parses UTC date-times to calendar dates', () => {
    const value = parseIcalDate('20260810T150000Z', {})
    expect(value?.date).toBe('2026-08-10')
    expect(value?.allDay).toBe(false)
  })
})

describe('eventStayDates', () => {
  it('keeps exclusive all-day checkout', () => {
    expect(
      eventStayDates(
        { date: '2026-08-10', allDay: true },
        { date: '2026-08-14', allDay: true },
      ),
    ).toEqual({ checkIn: '2026-08-10', checkOut: '2026-08-14' })
  })

  it('ensures at least one night', () => {
    expect(
      eventStayDates(
        { date: '2026-08-10', allDay: true },
        { date: '2026-08-10', allDay: true },
      ),
    ).toEqual({ checkIn: '2026-08-10', checkOut: '2026-08-11' })
  })

  it('addDaysISO crosses months', () => {
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01')
  })
})

describe('airbnb mapping', () => {
  it('classifies reserved, blocked, and named guests', () => {
    const events = parseIcs(SAMPLE_ICS).events
    expect(classifyAirbnbEvent(events[0]!)).toBe('reservation')
    expect(classifyAirbnbEvent(events[1]!)).toBe('block')
    expect(classifyAirbnbEvent(events[2]!)).toBe('reservation')

    const mapped = mapAirbnbEvents(events)
    expect(mapped.find((e) => e.uid.startsWith('booking'))?.guestName).toMatch(/Airbnb guest/)
    expect(mapped.find((e) => e.uid.startsWith('block'))?.guestName).toBe('Blocked (Airbnb)')
    expect(mapped.find((e) => e.uid.startsWith('guest'))?.guestName).toBe('Ama Mensah')
  })
})

describe('buildSyncPlan', () => {
  it('creates, updates, and cancels appropriately', () => {
    const events = mapAirbnbEvents(parseIcs(SAMPLE_ICS).events)
    const existing = [
      {
        id: 'r1',
        ical_uid: 'booking-abc123@airbnb.com',
        guest_name: 'Airbnb guest (bookinga)',
        check_in: '2026-08-10',
        check_out: '2026-08-13',
        status: 'confirmed',
      },
      {
        id: 'r2',
        ical_uid: 'gone@airbnb.com',
        guest_name: 'Old guest',
        check_in: '2026-07-01',
        check_out: '2026-07-03',
        status: 'confirmed',
      },
      {
        id: 'r3',
        ical_uid: 'inhouse@airbnb.com',
        guest_name: 'In house',
        check_in: '2026-08-01',
        check_out: '2026-08-05',
        status: 'checked_in',
      },
    ]

    const plan = buildSyncPlan(events, existing)
    const types = plan.actions.map((a) => a.type)
    expect(types).toContain('update')
    expect(types).toContain('create')
    expect(types).toContain('cancel')
    expect(
      plan.actions.some(
        (a) => a.type === 'skip' && a.icalUid === 'inhouse@airbnb.com',
      ),
    ).toBe(true)
  })
})

describe('buildAvailabilityIcs', () => {
  it('excludes import-feed reservations and emits valid ICS', () => {
    const ics = buildAvailabilityIcs({
      calendarName: 'Room 1',
      excludeImportFeedId: 'feed-import',
      reservations: [
        {
          id: 'a',
          guest_name: 'Walk-in',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
          status: 'confirmed',
          channel: 'walk_in',
          ical_uid: null,
          ical_feed_id: null,
        },
        {
          id: 'b',
          guest_name: 'Airbnb guest',
          check_in: '2026-08-15',
          check_out: '2026-08-18',
          status: 'confirmed',
          channel: 'airbnb',
          ical_uid: 'x@airbnb.com',
          ical_feed_id: 'feed-import',
        },
      ],
    })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('Walk-in')
    expect(ics).not.toContain('x@airbnb.com')
  })
})
