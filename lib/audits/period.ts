/**
 * Period close helpers for monthly and yearly audits (mirrors night audit flow).
 */

export type PeriodAuditType = 'monthly' | 'yearly'

export interface CalendarMonth {
  year: number
  month: number
  key: string
  label: string
  startDate: string
  endDate: string
  daysInMonth: number
}

export interface CalendarYear {
  year: number
  key: string
  label: string
  startDate: string
  endDate: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function calendarMonthFromParts(year: number, month: number): CalendarMonth {
  const endDay = lastDayOfMonth(year, month)
  const startDate = `${year}-${pad2(month)}-01`
  const endDate = `${year}-${pad2(month)}-${pad2(endDay)}`
  const label = new Date(`${startDate}T12:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
  return {
    year,
    month,
    key: `${year}-${pad2(month)}`,
    label,
    startDate,
    endDate,
    daysInMonth: endDay,
  }
}

export function currentCalendarMonth(now = new Date()): CalendarMonth {
  return calendarMonthFromParts(now.getFullYear(), now.getMonth() + 1)
}

export function currentCalendarYear(now = new Date()): CalendarYear {
  const year = now.getFullYear()
  return {
    year,
    key: String(year),
    label: String(year),
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

export function periodAuditLabel(type: PeriodAuditType, year: number, month: number | null): string {
  if (type === 'yearly') return String(year)
  return calendarMonthFromParts(year, month!).label
}
