'use client'

import { TrendingUp, Users, Percent, Banknote } from 'lucide-react'
import { kpiMetrics } from '@/lib/mock-data'

export function KPICards() {
  const cards = [
    {
      icon: Banknote,
      label: 'Total Revenue',
      value: `₵${kpiMetrics.totalRevenue.toLocaleString()}`,
      subtext: '+12% from last month',
      trend: 'up',
      accent: 'from-emerald-500/15 to-emerald-500/5',
      iconBg: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/20',
    },
    {
      icon: Percent,
      label: 'Occupancy Rate',
      value: `${(kpiMetrics.occupancyRate * 100).toFixed(0)}%`,
      subtext: '+5% improvement',
      trend: 'up',
      accent: 'from-blue-500/15 to-blue-500/5',
      iconBg: 'bg-blue-500/15 text-blue-700 ring-blue-500/20',
    },
    {
      icon: Banknote,
      label: 'Avg. Nightly Rate',
      value: `₵${kpiMetrics.averageNightlyRate}`,
      subtext: 'Per available room',
      trend: 'neutral',
      accent: 'from-violet-500/15 to-violet-500/5',
      iconBg: 'bg-violet-500/15 text-violet-700 ring-violet-500/20',
    },
    {
      icon: Users,
      label: 'Total Bookings',
      value: kpiMetrics.totalBookings.toString(),
      subtext: `${kpiMetrics.totalGuests} guests`,
      trend: 'up',
      accent: 'from-amber-500/15 to-amber-500/5',
      iconBg: 'bg-amber-500/15 text-amber-700 ring-amber-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => {
        const Icon = card.icon
        return (
          <div key={idx} className="kpi-card group">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-80`} />

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
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
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
