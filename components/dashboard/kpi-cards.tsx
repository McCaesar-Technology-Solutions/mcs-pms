'use client'

import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp, Users, Percent, Banknote, AlertCircle, BarChart3 } from 'lucide-react'
import { AnimatedMetric } from '@/components/dashboard/animated-metric'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import { OccupancyRing } from '@/components/dashboard/occupancy-ring'
import { TrendBadge } from '@/components/dashboard/trend-badge'
import type { RevenueTrend } from '@/lib/data/overview'
import type { KPIMetrics } from '@/types'
import type { LucideIcon } from 'lucide-react'

interface KPICardsProps {
  metrics?: KPIMetrics
  revenueTrend?: RevenueTrend
  occupancySparkline?: number[]
  revenueSparkline?: number[]
  showRevenue?: boolean
}

type CardTier = 'hero' | 'accent' | 'standard'
type CardStatus = 'success' | 'warning' | 'neutral'
type CardVariant = 'revenue' | 'occupancy' | 'default'

interface KpiCardDef {
  icon: LucideIcon
  label: string
  value: string
  rawValue?: number
  formatValue?: (n: number) => string
  subtext: string
  trend?: 'up' | 'down'
  trendPercent?: number | null
  tier: CardTier
  variant?: CardVariant
  status?: CardStatus
  sparkline?: number[]
  sparkTone?: 'primary' | 'gold' | 'emerald' | 'amber'
  occupancyPercent?: number
  extra?: ReactNode
}

function statusClass(status?: CardStatus) {
  if (status === 'success') return 'kpi-card--status-success'
  if (status === 'warning') return 'kpi-card--status-warning'
  return ''
}

function variantClass(variant?: CardVariant) {
  if (variant === 'revenue') return 'kpi-card--revenue'
  if (variant === 'occupancy') return 'kpi-card--occupancy'
  return ''
}

function occupancyStatus(rate: number): CardStatus {
  if (rate >= 0.7) return 'success'
  if (rate < 0.4) return 'warning'
  return 'neutral'
}

function KpiCard({ card }: { card: KpiCardDef }) {
  const Icon = card.icon
  const isHero = card.tier === 'hero'
  const isAccent = card.tier === 'accent'
  const isRevenue = card.variant === 'revenue'
  const isOccupancy = card.variant === 'occupancy'

  return (
    <div
      className={`kpi-card group ${statusClass(card.status)} ${variantClass(card.variant)} ${
        isHero ? 'kpi-card--hero' : isAccent ? 'kpi-card--accent' : 'kpi-card--standard'
      }`}
    >
      <div className="kpi-card__glow" aria-hidden />
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="kpi-card__icon">
              <Icon strokeWidth={2} />
            </span>
            <p className="kpi-card__label">{card.label}</p>
          </div>
          {card.trendPercent != null && <TrendBadge value={card.trendPercent} />}
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <p
            className={`min-w-0 font-bold tabular-nums tracking-tight text-foreground ${
              isRevenue
                ? 'text-[2.5rem] leading-none sm:text-[3.25rem]'
                : isOccupancy || isHero
                  ? 'text-4xl leading-none sm:text-5xl'
                  : isAccent
                    ? 'text-3xl leading-none sm:text-4xl'
                    : 'text-2xl'
            }`}
          >
            {card.rawValue != null && card.formatValue ? (
              <AnimatedMetric value={card.rawValue} format={card.formatValue} />
            ) : (
              card.value
            )}
          </p>

          {isOccupancy && card.occupancyPercent != null ? (
            <OccupancyRing
              percent={card.occupancyPercent}
              size={isHero || isAccent ? 64 : 52}
              showLabel={false}
            />
          ) : (
            card.sparkline &&
            card.sparkline.length >= 2 && (
              <MiniSparkline
                values={card.sparkline}
                tone={card.sparkTone}
                className={isHero ? 'h-10 w-24' : ''}
              />
            )
          )}
        </div>

        {card.extra}

        <div className="mt-auto flex items-center gap-1.5 border-t border-border/50 pt-3.5">
          {card.trend === 'up' && (
            <TrendingUp
              className={`shrink-0 ${isAccent ? 'text-[var(--brand-gold-dark)]' : 'text-emerald-600'}`}
              style={{ width: isHero ? 14 : 12, height: isHero ? 14 : 12 }}
            />
          )}
          {card.trend === 'down' && (
            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-[var(--brand-orange)]" />
          )}
          <p className={`text-muted-foreground ${isHero ? 'text-sm' : 'text-xs'}`}>{card.subtext}</p>
        </div>
      </div>
    </div>
  )
}

function RevenueTrendBlock({ trend }: { trend: RevenueTrend }) {
  const hasComparison = trend.lastMonth > 0 || trend.thisMonth > 0
  if (!hasComparison) return null

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="kpi-metric-pill">
        <p className="kpi-metric-pill__label">This month</p>
        <p className="kpi-metric-pill__value">₵{trend.thisMonth.toLocaleString()}</p>
      </div>
      <div className="kpi-metric-pill">
        <p className="kpi-metric-pill__label">Last month</p>
        <p className="kpi-metric-pill__value">₵{trend.lastMonth.toLocaleString()}</p>
      </div>
      {trend.changePercent != null && (
        <div className="kpi-metric-pill col-span-2 sm:col-span-1">
          <p className="kpi-metric-pill__label">Month change</p>
          <p
            className={`kpi-metric-pill__value ${
              trend.changePercent >= 0 ? 'text-emerald-700' : 'text-[var(--brand-orange)]'
            }`}
          >
            {trend.changePercent >= 0 ? '+' : ''}
            {trend.changePercent}%
          </p>
        </div>
      )}
    </div>
  )
}

export function KPICards({
  metrics,
  revenueTrend,
  occupancySparkline,
  revenueSparkline,
  showRevenue = true,
}: KPICardsProps) {
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
  const occupancyRate = m.occupancyRate * 100
  const occStatus = occupancyStatus(m.occupancyRate)

  const revenueTrendDir =
    revenueTrend?.changePercent != null
      ? revenueTrend.changePercent >= 0
        ? 'up'
        : 'down'
      : undefined

  const heroCards: KpiCardDef[] = showRevenue
    ? [
        {
          icon: Banknote,
          label: 'Total revenue',
          value: `₵${m.totalRevenue.toLocaleString()}`,
          rawValue: m.totalRevenue,
          formatValue: (n) => `₵${Math.round(n).toLocaleString()}`,
          subtext: `RevPAR ₵${m.reviParMetric.toLocaleString()} per available room`,
          trend: revenueTrendDir ?? 'up',
          trendPercent: revenueTrend?.changePercent ?? null,
          tier: 'hero',
          variant: 'revenue',
          sparkline: revenueSparkline,
          sparkTone: 'primary',
          extra: revenueTrend ? <RevenueTrendBlock trend={revenueTrend} /> : undefined,
        },
        {
          icon: Percent,
          label: 'Occupancy rate',
          value: `${occupancyRate.toFixed(0)}%`,
          rawValue: occupancyRate,
          formatValue: (n) => `${Math.round(n)}%`,
          subtext: 'Rooms occupied right now',
          trend: occStatus === 'success' ? 'up' : undefined,
          tier: 'accent',
          variant: 'occupancy',
          status: occStatus,
          occupancyPercent: occupancyRate,
          sparkline: occupancySparkline,
          sparkTone: occStatus === 'warning' ? 'amber' : 'gold',
        },
      ]
    : [
        {
          icon: Percent,
          label: 'Occupancy rate',
          value: `${occupancyRate.toFixed(0)}%`,
          rawValue: occupancyRate,
          formatValue: (n) => `${Math.round(n)}%`,
          subtext: 'Rooms occupied right now',
          trend: occStatus === 'success' ? 'up' : undefined,
          tier: 'hero',
          variant: 'occupancy',
          status: occStatus,
          occupancyPercent: occupancyRate,
          sparkline: occupancySparkline,
          sparkTone: occStatus === 'warning' ? 'amber' : 'emerald',
        },
        {
          icon: Users,
          label: 'Active bookings',
          value: m.totalBookings.toString(),
          rawValue: m.totalBookings,
          formatValue: (n) => Math.round(n).toString(),
          subtext: `${m.totalGuests} guests on record`,
          trend: 'up',
          tier: 'accent',
          sparkTone: 'primary',
        },
      ]

  const balanceStatus: CardStatus = m.outstandingBalance > 0 ? 'warning' : 'success'

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
            rawValue: m.totalBookings,
            formatValue: (n: number) => Math.round(n).toString(),
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
      rawValue: m.outstandingBalance,
      formatValue: (n) => `₵${Math.round(n).toLocaleString()}`,
      subtext:
        m.outstandingCount > 0
          ? `${m.outstandingCount} invoice${m.outstandingCount === 1 ? '' : 's'} awaiting payment`
          : 'All guest balances settled',
      tier: 'standard',
      status: balanceStatus,
    },
  ]

  return (
    <div className="space-y-4">
      <div
        className={`grid grid-cols-1 gap-4 ${
          showRevenue ? 'lg:grid-cols-5' : 'lg:grid-cols-2'
        }`}
      >
        {heroCards.map((card, i) => (
          <div
            key={card.label}
            className={
              showRevenue
                ? i === 0
                  ? 'lg:col-span-3'
                  : 'lg:col-span-2'
                : undefined
            }
          >
            <KpiCard card={card} />
          </div>
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
