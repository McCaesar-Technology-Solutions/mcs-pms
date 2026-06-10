'use client'

import { TrendingUp, Users, Percent, Banknote } from 'lucide-react'
import { kpiMetrics as mockKpiMetrics } from '@/lib/mock-data'
import type { KPIMetrics } from '@/types'

export function KPICards({ metrics }: { metrics?: KPIMetrics }) {
  const kpiMetrics = metrics ?? mockKpiMetrics
  const cards = [
    {
      icon: Banknote,
      label: 'Total Revenue',
      value: `₵${kpiMetrics.totalRevenue.toLocaleString()}`,
      subtext: `RevPAR ₵${kpiMetrics.reviParMetric.toLocaleString()}`,
      trend: 'up',
      tint: 'bg-[#3C216C]/10',
      iconBg: 'bg-[#3C216C]/15 text-[#3C216C] ring-[#3C216C]/20',
    },
    {
      icon: Percent,
      label: 'Occupancy Rate',
      value: `${(kpiMetrics.occupancyRate * 100).toFixed(0)}%`,
      subtext: 'Rooms occupied now',
      trend: 'up',
      tint: 'bg-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-700 ring-blue-500/20',
    },
    {
      icon: Banknote,
      label: 'Avg. Nightly Rate',
      value: `₵${kpiMetrics.averageNightlyRate}`,
      subtext: 'Per available room',
      trend: 'neutral',
      tint: 'bg-[#3C216C]/10',
      iconBg: 'bg-[#3C216C]/15 text-[#3C216C] ring-[#3C216C]/20',
    },
    {
      icon: Users,
      label: 'Total Bookings',
      value: kpiMetrics.totalBookings.toString(),
      subtext: `${kpiMetrics.totalGuests} guests`,
      trend: 'up',
      tint: 'bg-[#D4A62E]/10',
      iconBg: 'bg-[#D4A62E]/15 text-[#B88D24] ring-[#D4A62E]/25',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => {
        const Icon = card.icon
        return (
          <div key={idx} className="kpi-card group">
            <div className={`absolute inset-0 ${card.tint}`} />

            <div className="relative z-10 p-6">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ring-1 ${card.iconBg}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {card.trend === 'up' && (
                  <TrendingUp className="h-3.5 w-3.5 text-[#D4A62E]" />
                )}
                <p className="text-sm font-medium text-muted-foreground">{card.subtext}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
