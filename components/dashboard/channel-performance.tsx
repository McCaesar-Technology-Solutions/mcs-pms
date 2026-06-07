'use client'

import { channelPerformance } from '@/lib/mock-data'
import { TrendingUp } from 'lucide-react'

export function ChannelPerformanceWidget() {
  const totalBookings = channelPerformance.reduce((sum, c) => sum + c.bookings, 0)
  const totalRevenue = channelPerformance.reduce((sum, c) => sum + c.revenue, 0)

  const getChannelLabel = (channel: string) => {
    return channel.charAt(0).toUpperCase() + channel.slice(1).replace('_', ' ')
  }

  return (
    <div className="surface-card">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-foreground">Channel Performance</h3>
        <p className="text-sm text-muted-foreground mt-1">Revenue and booking distribution by source</p>
      </div>

      <div className="p-6 space-y-5">
        {channelPerformance.map((channel, idx) => {
          const bookingPercent = (channel.bookings / totalBookings) * 100
          const revenuePercent = (channel.revenue / totalRevenue) * 100

          return (
            <div key={idx} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{getChannelLabel(channel.channel)}</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">₵{channel.revenue}</span>
                  {channel.averageRating && (
                    <span className="text-xs bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full font-semibold shadow-elevation-1">
                      {channel.averageRating}★
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gradient-to-r from-secondary to-secondary/50 rounded-full h-2.5 overflow-hidden shadow-elevation-1">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/80 h-full transition-all duration-500"
                    style={{ width: `${revenuePercent}%` }}
                  ></div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground w-10 text-right">{channel.bookings} bookings</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 mx-6 mb-6 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 shadow-elevation-1">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Revenue Breakdown</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Website leads with {((channelPerformance[0].revenue / totalRevenue) * 100).toFixed(0)}% of total revenue
        </p>
      </div>
    </div>
  )
}
