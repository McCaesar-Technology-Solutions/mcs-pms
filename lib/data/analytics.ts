import type { ChannelPerf } from '@/lib/data/overview'
import type { DbInvoice, KPIMetrics, Reservation } from '@/types'
import { filterMetricsEligible } from '@/lib/reservations/lifecycle'

export interface AnalyticsWeeklyPoint {
  day: string
  date: string
  bookings: number
  revenue: number
}

export interface AnalyticsMonthlyPoint {
  month: string
  revenue: number
  bookings: number
}

export interface AnalyticsData {
  totalBookings: number
  totalGuests: number
  occupancyRate: number
  totalRevenue: number
  averageNightlyRate: number
  revPar: number
  avgStayNights: number
  repeatRatePct: number
  revenueGrowthPct: number | null
  bookingGrowthPct: number | null
  cancellationRatePct: number
  collectionRatePct: number | null
  peakDay: string | null
  avgGuestRating: number | null
  feedbackCount: number
  weekly: AnalyticsWeeklyPoint[]
  monthly: AnalyticsMonthlyPoint[]
  channels: ChannelPerf[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function monthKey(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function computeAnalytics(input: {
  reservations: Reservation[]
  metrics: KPIMetrics
  invoices?: DbInvoice[]
  channels?: ChannelPerf[]
  guestFeedback?: { averageRating: number | null; totalCount: number }
}): AnalyticsData {
  const { reservations, metrics, invoices = [], channels = [], guestFeedback } = input
  const active = filterMetricsEligible(reservations)
  const cancelled = reservations.filter((r) => r.status === 'cancelled').length
  const totalWithCancelled = reservations.length
  const cancellationRatePct =
    totalWithCancelled > 0 ? Math.round((cancelled / totalWithCancelled) * 100) : 0

  const totalNights = active.reduce((sum, r) => sum + r.numberOfNights, 0)
  const avgStayNights =
    active.length > 0 ? Math.round((totalNights / active.length) * 10) / 10 : 0

  const staysByGuest = new Map<string, number>()
  for (const r of active) {
    if (!r.guestId) continue
    staysByGuest.set(r.guestId, (staysByGuest.get(r.guestId) ?? 0) + 1)
  }
  const distinctGuests = staysByGuest.size
  const repeatGuests = [...staysByGuest.values()].filter((n) => n >= 2).length
  const repeatRatePct =
    distinctGuests > 0 ? Math.round((repeatGuests / distinctGuests) * 100) : 0

  const weekdayCounts = new Array(7).fill(0)
  for (const r of active) {
    const d = new Date(r.checkInDate + 'T12:00:00')
    if (!Number.isNaN(d.getTime())) weekdayCounts[d.getDay()] += 1
  }
  const maxWeekday = Math.max(...weekdayCounts)
  const peakDay =
    maxWeekday > 0 ? WEEKDAY_NAMES[weekdayCounts.indexOf(maxWeekday)] : null

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)
  const lastMonth = lastMonthDate.getMonth()
  const lastMonthYear = lastMonthDate.getFullYear()

  let thisMonthRevenue = 0
  let lastMonthRevenue = 0
  let thisMonthBookings = 0
  let lastMonthBookings = 0

  for (const r of active) {
    const d = new Date(r.checkInDate + 'T12:00:00')
    if (Number.isNaN(d.getTime())) continue
    if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
      thisMonthRevenue += r.totalPrice
      thisMonthBookings += 1
    } else if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) {
      lastMonthRevenue += r.totalPrice
      lastMonthBookings += 1
    }
  }

  const revenueGrowthPct =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null
  const bookingGrowthPct =
    lastMonthBookings > 0
      ? Math.round(((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100)
      : null

  const weekly: AnalyticsWeeklyPoint[] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = dateKey(day)
    const dayRes = active.filter((r) => r.checkInDate === key)
    weekly.push({
      day: WEEKDAYS[day.getDay()],
      date: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      bookings: dayRes.length,
      revenue: dayRes.reduce((sum, r) => sum + r.totalPrice, 0),
    })
  }

  const monthly: AnalyticsMonthlyPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(thisYear, thisMonth - i, 1)
    const m = monthStart.getMonth()
    const y = monthStart.getFullYear()
    const monthRes = active.filter((r) => {
      const d = new Date(r.checkInDate + 'T12:00:00')
      return !Number.isNaN(d.getTime()) && d.getMonth() === m && d.getFullYear() === y
    })
    monthly.push({
      month: monthKey(monthStart),
      revenue: monthRes.reduce((sum, r) => sum + r.totalPrice, 0),
      bookings: monthRes.length,
    })
  }

  let collectionRatePct: number | null = null
  if (invoices.length > 0) {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)
    const collected = invoices
      .filter((inv) => inv.payment_status === 'paid')
      .reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)
    collectionRatePct =
      totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : null
  }

  return {
    totalBookings: active.length,
    totalGuests: metrics.totalGuests,
    occupancyRate: metrics.occupancyRate,
    totalRevenue: metrics.totalRevenue,
    averageNightlyRate: metrics.averageNightlyRate,
    revPar: metrics.reviParMetric,
    avgStayNights,
    repeatRatePct,
    revenueGrowthPct,
    bookingGrowthPct,
    cancellationRatePct,
    collectionRatePct,
    peakDay,
    avgGuestRating: guestFeedback?.averageRating ?? null,
    feedbackCount: guestFeedback?.totalCount ?? 0,
    weekly,
    monthly,
    channels,
  }
}
