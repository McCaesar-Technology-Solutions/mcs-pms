import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp, Users, Percent, Banknote, AlertCircle, BarChart3 } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import type { RevenueTrend } from '@/lib/data/overview'
import type { KPIMetrics } from '@/types'
import type { LucideIcon } from 'lucide-react'

interface KPICardsProps {
  metrics?: KPIMetrics
  revenueTrend?: RevenueTrend
  occupancySparkline?: number[]
  revenueSparkline?: number[]
  /** Hide revenue-related metrics (e.g. for managers). */
  showRevenue?: boolean
}

type CardTier = 'hero' | 'accent' | 'standard'
type CardStatus = 'success' | 'warning' | 'neutral'

interface KpiCardDef {
  icon: LucideIcon
  label: string
  value: string
  subtext: string
  trend?: 'up' | 'down'
  tier: CardTier
  status?: CardStatus
  sparkline?: number[]
  sparkTone?: 'primary' | 'gold' | 'emerald' | 'amber'
  extra?: ReactNode
}

function statusClass(status?: CardStatus) {
  if (status === 'success') return 'kpi-card--status-success'
  if (status === 'warning') return 'kpi-card--status-warning'
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

  return (
    <div
      className={`kpi-card group ${statusClass(card.status)} ${
        isHero ? 'kpi-card--hero' : isAccent ? 'kpi-card--accent' : 'kpi-card--standard'
      }`}
    >
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`min-w-0 font-bold tabular-nums tracking-tight text-foreground ${
              isHero
                ? 'text-4xl sm:text-[2.85rem] sm:leading-none'
                : isAccent
                  ? 'text-3xl sm:text-4xl sm:leading-none'
                  : 'text-2xl'
            }`}
          >
            {card.value}
          </p>
          {card.sparkline && card.sparkline.length >= 2 && (
            <MiniSparkline values={card.sparkline} tone={card.sparkTone} />
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
          <Icon
            className={`shrink-0 opacity-75 ${isHero ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
            strokeWidth={2}
          />
          <p className={`font-medium ${isHero ? 'text-xs' : 'text-[11px]'}`}>{card.label}</p>
        </div>
        {card.extra}
        <div className="mt-auto flex items-center gap-1.5 pt-3">
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

  const up = trend.changePercent != null && trend.changePercent >= 0

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
      {trend.changePercent != null && (
        <span
          className={`inline-flex items-center gap-1 font-semibold ${up ? 'text-emerald-700' : 'text-[var(--brand-orange)]'}`}
        >
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {up ? '+' : ''}
          {trend.changePercent}% vs last month
        </span>
      )}
      <span>
        This month{' '}
        <span className="font-semibold text-foreground">₵{trend.thisMonth.toLocaleString()}</span>
      </span>
      <span>
        Last month{' '}
        <span className="font-semibold text-foreground">₵{trend.lastMonth.toLocaleString()}</span>
      </span>
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
  const occupancyPct = `${(m.occupancyRate * 100).toFixed(0)}%`
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
          subtext: `RevPAR ₵${m.reviParMetric.toLocaleString()} per room`,
          trend: revenueTrendDir ?? 'up',
          tier: 'hero',
          sparkline: revenueSparkline,
          sparkTone: 'primary',
          extra: revenueTrend ? <RevenueTrendBlock trend={revenueTrend} /> : undefined,
        },
        {
          icon: Percent,
          label: 'Occupancy rate',
          value: occupancyPct,
          subtext: 'Rooms occupied right now',
          trend: occStatus === 'success' ? 'up' : undefined,
          tier: 'accent',
          status: occStatus,
          sparkline: occupancySparkline,
          sparkTone: occStatus === 'warning' ? 'amber' : 'gold',
        },
      ]
    : [
        {
          icon: Percent,
          label: 'Occupancy rate',
          value: occupancyPct,
          subtext: 'Rooms occupied right now',
          trend: occStatus === 'success' ? 'up' : undefined,
          tier: 'hero',
          status: occStatus,
          sparkline: occupancySparkline,
          sparkTone: occStatus === 'warning' ? 'amber' : 'emerald',
        },
        {
          icon: Users,
          label: 'Active bookings',
          value: m.totalBookings.toString(),
          subtext: `${m.totalGuests} guests on record`,
          trend: 'up',
          tier: 'accent',
          sparkTone: 'primary',
        },
      ]

  const balanceStatus: CardStatus =
    m.outstandingBalance > 0 ? 'warning' : 'success'

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
      status: balanceStatus,
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
