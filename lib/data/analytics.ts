import type { KPIMetrics, Reservation } from '@/types'

export interface AnalyticsData {
  totalBookings: number
  occupancyRate: number
  totalRevenue: number
  avgStayNights: number
  repeatRatePct: number
  revenueGrowthPct: number | null
  peakDay: string | null
  weekly: { day: string; bookings: number; revenue: number }[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function computeAnalytics(
  reservations: Reservation[],
  metrics: KPIMetrics,
): AnalyticsData {
  const active = reservations.filter((r) => r.status !== 'cancelled')

  const totalNights = active.reduce((sum, r) => sum + r.numberOfNights, 0)
  const avgStayNights = active.length > 0 ? Math.round((totalNights / active.length) * 10) / 10 : 0

  const staysByGuest = new Map<string, number>()
  for (const r of active) {
    if (!r.guestId) continue
    staysByGuest.set(r.guestId, (staysByGuest.get(r.guestId) ?? 0) + 1)
  }
  const distinctGuests = staysByGuest.size
  const repeatGuests = [...staysByGuest.values()].filter((n) => n >= 2).length
  const repeatRatePct = distinctGuests > 0 ? Math.round((repeatGuests / distinctGuests) * 100) : 0

  const weekdayCounts = new Array(7).fill(0)
  for (const r of active) {
    const d = new Date(r.checkInDate + 'T12:00:00')
    if (!Number.isNaN(d.getTime())) weekdayCounts[d.getDay()] += 1
  }
  const maxWeekday = Math.max(...weekdayCounts)
  const peakDay =
    maxWeekday > 0
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
          weekdayCounts.indexOf(maxWeekday)
        ]
      : null

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)
  const lastMonth = lastMonthDate.getMonth()
  const lastMonthYear = lastMonthDate.getFullYear()

  let thisMonthRevenue = 0
  let lastMonthRevenue = 0
  for (const r of active) {
    const d = new Date(r.checkInDate + 'T12:00:00')
    if (Number.isNaN(d.getTime())) continue
    if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) thisMonthRevenue += r.totalPrice
    else if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear)
      lastMonthRevenue += r.totalPrice
  }
  const revenueGrowthPct =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null

  const weekly: AnalyticsData['weekly'] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = dateKey(day)
    const dayRes = active.filter((r) => r.checkInDate === key)
    weekly.push({
      day: WEEKDAYS[day.getDay()],
      bookings: dayRes.length,
      revenue: dayRes.reduce((sum, r) => sum + r.totalPrice, 0),
    })
  }

  return {
    totalBookings: active.length,
    occupancyRate: metrics.occupancyRate,
    totalRevenue: metrics.totalRevenue,
    avgStayNights,
    repeatRatePct,
    revenueGrowthPct,
    peakDay,
    weekly,
  }
}
