import { describe, expect, it } from 'vitest'
import {
  attendanceDedupeKey,
  dedupeAttendanceRows,
  mapAttendanceEventType,
  parseAttendancePullRecord,
} from '@/lib/access/attendance-ingest'

describe('mapAttendanceEventType', () => {
  it('maps Hikvision attendanceStatus values', () => {
    expect(mapAttendanceEventType('checkIn')).toBe('clock_in')
    expect(mapAttendanceEventType('checkOut')).toBe('clock_out')
    expect(mapAttendanceEventType('breakOut')).toBe('clock_out')
    expect(mapAttendanceEventType('overtimeIn')).toBe('clock_in')
  })

  it('accepts agent-normalized eventType', () => {
    expect(mapAttendanceEventType('clock_in')).toBe('clock_in')
    expect(mapAttendanceEventType('clock_out')).toBe('clock_out')
  })

  it('falls back to unknown', () => {
    expect(mapAttendanceEventType('face')).toBe('unknown')
    expect(mapAttendanceEventType(null)).toBe('unknown')
  })
})

describe('parseAttendancePullRecord', () => {
  it('parses agent pull rows', () => {
    const row = parseAttendancePullRecord(
      {
        employeeNo: 'S12',
        occurredAt: '2026-08-10T08:01:00.000Z',
        eventType: 'clock_in',
        displayName: 'Ama',
        rawRef: '4421',
      },
      'attendance1',
    )
    expect(row).toEqual({
      employee_no: 'S12',
      display_name: 'Ama',
      event_type: 'clock_in',
      occurred_at: '2026-08-10T08:01:00.000Z',
      device_key: 'attendance1',
      raw_ref: '4421',
    })
  })

  it('rejects missing employee or time', () => {
    expect(parseAttendancePullRecord({ occurredAt: '2026-08-10T08:00:00Z' }, 'a')).toBeNull()
    expect(parseAttendancePullRecord({ employeeNo: '1' }, 'a')).toBeNull()
  })
})

describe('dedupeAttendanceRows', () => {
  it('keeps first of natural-key duplicates', () => {
    const rows = dedupeAttendanceRows([
      {
        hotel_id: 'h1',
        employee_no: '1',
        occurred_at: '2026-08-10T08:00:00.000Z',
        event_type: 'clock_in',
        device_key: 'att',
        display_name: 'First',
      },
      {
        hotel_id: 'h1',
        employee_no: '1',
        occurred_at: '2026-08-10T08:00:00.000Z',
        event_type: 'clock_in',
        device_key: 'att',
        display_name: 'Second',
      },
      {
        hotel_id: 'h1',
        employee_no: '1',
        occurred_at: '2026-08-10T17:00:00.000Z',
        event_type: 'clock_out',
        device_key: 'att',
        display_name: 'Out',
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.display_name).toBe('First')
    expect(
      attendanceDedupeKey({
        hotel_id: 'h1',
        employee_no: '1',
        occurred_at: 't',
        event_type: 'clock_in',
        device_key: null,
      }),
    ).toBe('h1|1|t|clock_in|')
  })
})
