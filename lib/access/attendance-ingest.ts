export type AttendanceEventType = 'clock_in' | 'clock_out' | 'unknown'

export type AttendanceIngestRow = {
  hotel_id: string
  credential_id: string | null
  profile_id: string | null
  employee_no: string
  display_name: string | null
  event_type: AttendanceEventType
  occurred_at: string
  device_key: string | null
  raw_ref: string | null
}

export function mapAttendanceEventType(raw: unknown): AttendanceEventType {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (!s) return 'unknown'
  if (
    s === 'checkin' ||
    s === 'clockin' ||
    s === 'clock_in' ||
    s === 'in' ||
    s === 'breakin' ||
    s === 'overtimein'
  ) {
    return 'clock_in'
  }
  if (
    s === 'checkout' ||
    s === 'clockout' ||
    s === 'out' ||
    s === 'breakout' ||
    s === 'overtimeout'
  ) {
    return 'clock_out'
  }
  return 'unknown'
}

/** Parse one agent / ISAPI record into a row shape (without credential lookup). */
export function parseAttendancePullRecord(
  raw: unknown,
  deviceKey: string | null,
): Omit<AttendanceIngestRow, 'hotel_id' | 'credential_id' | 'profile_id'> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const employeeNo = String(r.employeeNo ?? r.employee_no ?? '').trim()
  if (!employeeNo) return null

  const occurredRaw = r.occurredAt ?? r.occurred_at ?? r.time
  if (occurredRaw == null || occurredRaw === '') return null
  const occurredAt = new Date(String(occurredRaw))
  if (Number.isNaN(occurredAt.getTime())) return null

  const eventType = mapAttendanceEventType(r.eventType ?? r.event_type ?? r.attendanceStatus)

  const rawRef =
    typeof r.rawRef === 'string'
      ? r.rawRef
      : typeof r.raw_ref === 'string'
        ? r.raw_ref
        : r.serialNo != null
          ? String(r.serialNo)
          : null

  return {
    employee_no: employeeNo,
    display_name: typeof r.displayName === 'string' ? r.displayName : null,
    event_type: eventType,
    occurred_at: occurredAt.toISOString(),
    device_key: deviceKey,
    raw_ref: rawRef,
  }
}

export function attendanceDedupeKey(row: {
  hotel_id: string
  employee_no: string
  occurred_at: string
  event_type: string
  device_key: string | null
}): string {
  return [
    row.hotel_id,
    row.employee_no,
    row.occurred_at,
    row.event_type,
    row.device_key ?? '',
  ].join('|')
}

/** Drop duplicates within a single pull batch (keeps first). */
export function dedupeAttendanceRows<T extends {
  hotel_id: string
  employee_no: string
  occurred_at: string
  event_type: string
  device_key: string | null
}>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const key = attendanceDedupeKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
