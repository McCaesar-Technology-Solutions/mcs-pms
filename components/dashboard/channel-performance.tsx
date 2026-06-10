'use client'

import { channelPerformance as mockChannels } from '@/lib/mock-data'
import { TrendingUp } from 'lucide-react'
import type { ChannelPerf } from '@/lib/data/overview'
import type { Reservation } from '@/types'

const CHANNEL_LABEL: Record<Reservation['source'], string> = {
  website: 'Direct',
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  walk_in: 'Walk-in',
  other: 'Other',
}

interface ChannelPerformanceWidgetProps {
  channels?: ChannelPerf[]
}

export function ChannelPerformanceWidget({ channels }: ChannelPerformanceWidgetProps) {
  const data: ChannelPerf[] = channels ?? mockChannels.map((c) => ({
    channel: c.channel,
    bookings: c.bookings,
    revenue: c.revenue,
  }))

  const totalBookings = data.reduce((sum, c) => sum + c.bookings, 0)
  const totalRevenue = data.reduce((sum, c) => sum + c.revenue, 0)
  const topChannel = data[0]

  return (
    <div className="surface-card">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-foreground">Channel Performance</h3>
        <p className="text-sm text-muted-foreground mt-1">Revenue and booking distribution by source</p>
      </div>

      {data.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <>
          <div className="p-6 space-y-5">
            {data.map((channel, idx) => {
              const revenuePercent = totalRevenue > 0 ? (channel.revenue / totalRevenue) * 100 : 0

              return (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{CHANNEL_LABEL[channel.channel]}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">₵{channel.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-secondary rounded-full h-2.5 overflow-hidden shadow-elevation-1">
                      <div
                        className="bg-primary h-full transition-all duration-500"
                        style={{ width: `${revenuePercent}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground w-20 text-right">
                      {channel.bookings} bookings
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {topChannel && totalRevenue > 0 && (
            <div className="p-4 mx-6 mb-6 rounded-xl bg-primary/10 shadow-elevation-1">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Revenue Breakdown</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {CHANNEL_LABEL[topChannel.channel]} leads with{' '}
                {((topChannel.revenue / totalRevenue) * 100).toFixed(0)}% of total revenue
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
