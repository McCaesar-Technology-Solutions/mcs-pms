'use client'

import { TrendingUp, Users, Percent, Banknote, AlertCircle, BarChart3 } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { KPIMetrics } from '@/types'
import type { LucideIcon } from 'lucide-react'

interface KPICardsProps {
  metrics?: KPIMetrics
  /** Hide revenue-related metrics (e.g. for managers). */
  showRevenue?: boolean
}

type CardTier = 'hero' | 'accent' | 'standard'

interface KpiCardDef {
  icon: LucideIcon
  label: string
  value: string
  subtext: string
  trend?: 'up'
  tier: CardTier
}

function KpiCard({ card }: { card: KpiCardDef }) {
  const Icon = card.icon
  const isHero = card.tier === 'hero'
  const isAccent = card.tier === 'accent'

  return (
    <div
      className={`kpi-card group ${
        isHero ? 'kpi-card--hero' : isAccent ? 'kpi-card--accent' : 'kpi-card--standard'
      }`}
    >
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon
            className={`shrink-0 opacity-80 ${isHero ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
            strokeWidth={2}
          />
          <p className={`font-medium ${isHero ? 'text-xs' : 'text-[11px]'}`}>{card.label}</p>
        </div>
        <p
          className={`mt-2 font-bold tabular-nums tracking-tight ${
            isHero
              ? 'text-4xl text-foreground sm:text-[2.75rem] sm:leading-none'
              : isAccent
                ? 'text-3xl text-foreground sm:text-4xl'
                : 'text-2xl text-foreground'
          }`}
        >
          {card.value}
        </p>
        <div className="mt-auto flex items-center gap-1.5 pt-3">
          {card.trend === 'up' && (
            <TrendingUp
              className={`shrink-0 ${isAccent ? 'text-[var(--brand-gold-dark)]' : 'text-primary'}`}
              style={{ width: isHero ? 14 : 12, height: isHero ? 14 : 12 }}
            />
          )}
          <p className={`text-muted-foreground ${isHero ? 'text-sm' : 'text-xs'}`}>{card.subtext}</p>
        </div>
      </div>
    </div>
  )
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

  const m = metrics
  const occupancyPct = `${(m.occupancyRate * 100).toFixed(0)}%`

  const heroCards: KpiCardDef[] = showRevenue
    ? [
        {
          icon: Banknote,
          label: 'Total revenue',
          value: `₵${m.totalRevenue.toLocaleString()}`,
          subtext: `RevPAR ₵${m.reviParMetric.toLocaleString()}`,
          trend: 'up',
          tier: 'hero',
        },
        {
          icon: Percent,
          label: 'Occupancy rate',
          value: occupancyPct,
          subtext: 'Rooms occupied right now',
          trend: 'up',
          tier: 'accent',
        },
      ]
    : [
        {
          icon: Percent,
          label: 'Occupancy rate',
          value: occupancyPct,
          subtext: 'Rooms occupied right now',
          trend: 'up',
          tier: 'hero',
        },
        {
          icon: Users,
          label: 'Active bookings',
          value: m.totalBookings.toString(),
          subtext: `${m.totalGuests} guests on record`,
          trend: 'up',
          tier: 'accent',
        },
      ]

  const standardCards: KpiCardDef[] = [
    {
      icon: Banknote,
      label: showRevenue ? 'Avg. nightly rate' : 'Typical room rate',
      value: `₵${m.averageNightlyRate}`,
      subtext: showRevenue ? 'Average daily rate' : 'List price benchmark',
      tier: 'standard',
    },
    ...(showRevenue
      ? [
          {
            icon: Users,
            label: 'Active bookings',
            value: m.totalBookings.toString(),
            subtext: `${m.totalGuests} guests on record`,
            trend: 'up' as const,
            tier: 'standard' as const,
          },
        ]
      : []),
    {
      icon: AlertCircle,
      label: 'Unpaid balances',
      value: `₵${m.outstandingBalance.toLocaleString()}`,
      subtext:
        m.outstandingCount > 0
          ? `${m.outstandingCount} invoice${m.outstandingCount === 1 ? '' : 's'} awaiting payment`
          : 'All guest balances settled',
      tier: 'standard',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {heroCards.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
          showRevenue ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
        }`}
      >
        {standardCards.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>
    </div>
  )
}
