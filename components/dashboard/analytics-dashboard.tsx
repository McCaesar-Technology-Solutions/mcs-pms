'use client'

import { TrendingUp, BarChart3, Calendar } from 'lucide-react'
import type { AnalyticsData } from '@/lib/data/analytics'

const MOCK_DATA: AnalyticsData = {
  totalBookings: 45,
  occupancyRate: 0.73,
  totalRevenue: 20500,
  avgStayNights: 3.2,
  repeatRatePct: 94,
  revenueGrowthPct: 18,
  peakDay: 'Friday',
  weekly: [
    { day: 'Mon', bookings: 6, revenue: 2400 },
    { day: 'Tue', bookings: 8, revenue: 3200 },
    { day: 'Wed', bookings: 5, revenue: 2100 },
    { day: 'Thu', bookings: 9, revenue: 3600 },
    { day: 'Fri', bookings: 12, revenue: 4800 },
    { day: 'Sat', bookings: 7, revenue: 2800 },
    { day: 'Sun', bookings: 4, revenue: 1600 },
  ],
}

export function AnalyticsDashboard({ data }: { data?: AnalyticsData }) {
  const analytics = data ?? MOCK_DATA

  const growthLabel =
    analytics.revenueGrowthPct === null
      ? '—'
      : `${analytics.revenueGrowthPct >= 0 ? '+' : ''}${analytics.revenueGrowthPct}%`

  const metrics = [
    {
      label: 'Total Bookings',
      value: analytics.totalBookings.toString(),
      change: 'active reservations',
      color: 'bg-blue-50',
    },
    {
      label: 'Occupancy',
      value: `${Math.round(analytics.occupancyRate * 100)}%`,
      change: 'rooms occupied now',
      color: 'bg-amber-50',
    },
    {
      label: 'Avg Stay',
      value: `${analytics.avgStayNights}`,
      change: 'nights per booking',
      color: 'bg-[#FAFDFF]',
    },
    {
      label: 'Revenue Growth',
      value: growthLabel,
      change: 'vs last month',
      color: 'bg-[#FAFDFF]',
    },
  ]

  const maxBookings = Math.max(1, ...analytics.weekly.map((d) => d.bookings))
  const maxRevenue = Math.max(1, ...analytics.weekly.map((d) => d.revenue))

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, idx) => (
          <div key={idx} className={`surface-card stat-tile p-6 ${metric.color}`}>
            <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">{metric.label}</p>
            <p className="text-3xl font-bold text-foreground mt-3">{metric.value}</p>
            <div className="flex items-center gap-2 mt-3 text-primary text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              {metric.change}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Bookings — last 7 days</h3>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex items-end justify-between gap-2 h-40">
            {analytics.weekly.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="relative w-full flex items-end justify-center h-full">
                  <div
                    className="w-10 bg-primary rounded-t-lg hover:shadow-elevation-2 transition-shadow cursor-pointer"
                    style={{ height: `${(day.bookings / maxBookings) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs font-semibold text-foreground">{day.day}</p>
                <p className="text-xs text-muted-foreground">{day.bookings}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Revenue — last 7 days</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            {analytics.weekly.map((day, idx) => {
              const percentage = (day.revenue / maxRevenue) * 100
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{day.day}</p>
                    <p className="text-sm font-bold text-foreground">₵{day.revenue.toLocaleString()}</p>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="surface-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Performance Summary</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="info-block info-block-blue p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Avg Stay Length</p>
            <p className="text-3xl font-bold text-blue-600 mt-3">{analytics.avgStayNights}</p>
            <p className="text-xs text-muted-foreground mt-2">nights</p>
          </div>

          <div className="info-block info-block-emerald p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Repeat Guests</p>
            <p className="text-3xl font-bold text-amber-600 mt-3">{analytics.repeatRatePct}%</p>
            <p className="text-xs text-muted-foreground mt-2">return rate</p>
          </div>

          <div className="info-block info-block-purple p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Peak Day</p>
            <p className="text-2xl font-bold text-[#3C216C] mt-3">{analytics.peakDay ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-2">most check-ins</p>
          </div>
        </div>
      </div>
    </>
  )
}
