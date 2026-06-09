'use client'

import { TrendingUp, BarChart3, Calendar } from 'lucide-react'

export function AnalyticsDashboard() {
  const metrics = [
    { label: 'Total Bookings', value: 45, change: '+12%', color: 'bg-blue-50' },
    { label: 'Avg Rating', value: '4.7', change: '+0.2★', color: 'bg-amber-50' },
    { label: 'Occupancy', value: '73%', change: '+4%', color: 'bg-[#FAFDFF]' },
    { label: 'Revenue Growth', value: '+18%', change: 'vs last month', color: 'bg-[#FAFDFF]' },
  ]

  const weeklyData = [
    { day: 'Mon', bookings: 6, revenue: 2400 },
    { day: 'Tue', bookings: 8, revenue: 3200 },
    { day: 'Wed', bookings: 5, revenue: 2100 },
    { day: 'Thu', bookings: 9, revenue: 3600 },
    { day: 'Fri', bookings: 12, revenue: 4800 },
    { day: 'Sat', bookings: 7, revenue: 2800 },
    { day: 'Sun', bookings: 4, revenue: 1600 },
  ]

  const maxBookings = Math.max(...weeklyData.map((d) => d.bookings))

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
            <h3 className="text-lg font-semibold text-foreground">Weekly Bookings</h3>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyData.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="relative w-full flex items-end justify-center">
                  <div
                    className="w-10 bg-primary rounded-t-lg hover:shadow-elevation-2 transition-shadow cursor-pointer"
                    style={{ height: `${(day.bookings / maxBookings) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs font-semibold text-foreground">{day.day}</p>
                <p className="text-xs text-muted-foreground">{day.bookings} books</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Revenue Trend</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            {weeklyData.map((day, idx) => {
              const maxRevenue = Math.max(...weeklyData.map((d) => d.revenue))
              const percentage = (day.revenue / maxRevenue) * 100
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{day.day}</p>
                    <p className="text-sm font-bold text-foreground">₵{day.revenue}</p>
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
            <p className="text-3xl font-bold text-blue-600 mt-3">3.2</p>
            <p className="text-xs text-muted-foreground mt-2">nights</p>
          </div>

          <div className="info-block info-block-emerald p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Guest Satisfaction</p>
            <p className="text-3xl font-bold text-amber-600 mt-3">94%</p>
            <p className="text-xs text-muted-foreground mt-2">return rate</p>
          </div>

          <div className="info-block info-block-purple p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Peak Day</p>
            <p className="text-2xl font-bold text-[#3C216C] mt-3">Friday</p>
            <p className="text-xs text-muted-foreground mt-2">highest occupancy</p>
          </div>
        </div>
      </div>
    </>
  )
}
