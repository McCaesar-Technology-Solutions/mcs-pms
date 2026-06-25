import { describe, expect, it } from 'vitest'
import { generateICalFeed } from '@/lib/ical/generate'
import { parseICalDate, parseICalEvents } from '@/lib/ical/parse'

const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN
BEGIN:VEVENT
DTSTAMP:20240601T120000Z
DTSTART;VALUE=DATE:20240610
DTEND;VALUE=DATE:20240615
SUMMARY:Reserved
UID:airbnb-123@airbnb.com
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20240601T120000Z
DTSTART;VALUE=DATE:20240620
DTEND;VALUE=DATE:20240622
SUMMARY:John Smith
UID:airbnb-456@airbnb.com
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`

describe('parseICalDate', () => {
  it('parses DATE values', () => {
    expect(parseICalDate('20240610')).toBe('2024-06-10')
    expect(parseICalDate(';VALUE=DATE:20240610')).toBe('2024-06-10')
  })
})

describe('parseICalEvents', () => {
  it('extracts VEVENT blocks', () => {
    const events = parseICalEvents(SAMPLE_ICAL)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      uid: 'airbnb-123@airbnb.com',
      dtstart: '2024-06-10',
      dtend: '2024-06-15',
      summary: 'Reserved',
    })
    expect(events[1].status).toBe('CANCELLED')
  })

  it('unfolds wrapped lines', () => {
    const folded = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:folded@test
SUMMARY:Long guest name that wraps
 across a line
DTSTART;VALUE=DATE:20240701
DTEND;VALUE=DATE:20240703
END:VEVENT
END:VCALENDAR`
    const events = parseICalEvents(folded)
    expect(events[0].summary).toContain('across a line')
  })
})

describe('generateICalFeed', () => {
  it('outputs valid calendar structure', () => {
    const body = generateICalFeed({
      name: 'Room 101',
      events: [
        {
          uid: 'test-1@pms',
          summary: 'Reserved — Guest',
          dtstart: '2024-06-10',
          dtend: '2024-06-15',
        },
      ],
    })
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('DTSTART;VALUE=DATE:20240610')
    expect(body).toContain('DTEND;VALUE=DATE:20240615')
    expect(body).toContain('UID:test-1@pms')
    expect(body).toContain('END:VCALENDAR')

    const roundTrip = parseICalEvents(body)
    expect(roundTrip[0].dtstart).toBe('2024-06-10')
  })
})
