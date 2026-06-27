'use client'

import { TrendingUp, Users, Percent, Banknote, AlertCircle, BarChart3 } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { KPIMetrics } from '@/types'

interface KPICardsProps {
  metrics?: KPIMetrics
  /** Hide revenue-related metrics (e.g. for managers). */
  showRevenue?: boolean
}

export function KPICards({ metrics, showRevenue = true }: KPICardsProps) {
  if (!metrics) {
    return (
      <DataEmptyState
        icon={BarChart3}
        title="No metrics yet"
        message="Add reservations and room data to see occupancy, revenue, and booking trends here."
      />
    )
  }

  const kpiMetrics = metrics
  const cards = [
    ...(showRevenue
      ? [
          {
            icon: Banknote,
            label: 'Total revenue',
            value: `₵${kpiMetrics.totalRevenue.toLocaleString()}`,
            subtext: `RevPAR ₵${kpiMetrics.reviParMetric.toLocaleString()}`,
            trend: 'up' as const,
            tint: 'bg-primary/10',
            iconBg: 'bg-primary/15 text-primary ring-primary/25',
          },
        ]
      : []),
    {
      icon: Percent,
      label: 'Occupancy rate',
      value: `${(kpiMetrics.occupancyRate * 100).toFixed(0)}%`,
      subtext: 'Rooms occupied now',
      trend: 'up' as const,
      tint: 'bg-primary/8',
      iconBg: 'bg-primary/12 text-primary ring-primary/20',
    },
    {
      icon: Banknote,
      label: showRevenue ? 'Avg. nightly rate' : 'Typical room rate',
      value: `₵${kpiMetrics.averageNightlyRate}`,
      subtext: showRevenue ? 'Per available room' : 'List price benchmark',
      trend: 'neutral' as const,
      tint: 'bg-primary/10',
      iconBg: 'bg-primary/15 text-primary ring-primary/20',
    },
    {
      icon: Users,
      label: 'Total bookings',
      value: kpiMetrics.totalBookings.toString(),
      subtext: `${kpiMetrics.totalGuests} guests`,
      trend: 'up' as const,
      tint: 'bg-primary/6',
      iconBg: 'bg-primary/10 text-primary ring-primary/18',
    },
    {
      icon: AlertCircle,
      label: 'Outstanding',
      value: `₵${kpiMetrics.outstandingBalance.toLocaleString()}`,
      subtext:
        kpiMetrics.outstandingCount > 0
          ? `${kpiMetrics.outstandingCount} open balance${kpiMetrics.outstandingCount === 1 ? '' : 's'}`
          : 'All settled',
      trend: (kpiMetrics.outstandingBalance > 0 ? 'neutral' : 'up') as 'neutral' | 'up',
      tint: kpiMetrics.outstandingBalance > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      iconBg:
        kpiMetrics.outstandingBalance > 0
          ? 'bg-amber-500/15 text-amber-800 ring-amber-500/20'
          : 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {cards.map((card, idx) => {
        const Icon = card.icon
        return (
          <div key={idx} className="kpi-card group">
            <div className={`absolute inset-0 ${card.tint}`} />

            <div className="relative z-10 p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="label-eyebrow">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground md:text-4xl">
                    {card.value}
                  </p>
                </div>
                <div className={`shrink-0 rounded-xl p-3 ring-1 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${card.iconBg}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {card.trend === 'up' && (
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
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
