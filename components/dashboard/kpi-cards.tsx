'use client'

import type { ReactNode } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import { AnimatedMetric } from '@/components/dashboard/animated-metric'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import { OccupancySnapshot } from '@/components/dashboard/occupancy-snapshot'
import { TrendBadge } from '@/components/dashboard/trend-badge'
import type { RevenueTrend } from '@/lib/data/overview'
import type { OccupancyToday } from '@/lib/data/occupancy'
import type { KPIMetrics } from '@/types'

interface KPICardsProps {
  metrics?: KPIMetrics
  revenueTrend?: RevenueTrend
  revenueSparkline?: number[]
  bookingsSparkline?: number[]
  occupancyToday?: OccupancyToday
  occupancySparkline?: number[]
  showRevenue?: boolean
  compactMetrics?: boolean
  aside?: ReactNode
  roomsHref?: string
}

function hasSparklineVariance(values?: number[]) {
  return values && values.length >= 2 && new Set(values).size > 1
}

function RevenueBanner({
  metrics,
  revenueTrend,
  revenueSparkline,
}: {
  metrics: KPIMetrics
  revenueTrend?: RevenueTrend
  revenueSparkline?: number[]
}) {
  return (
    <div className="kpi-card kpi-card--revenue">
      <div className="kpi-card--revenue__body">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="kpi-card__label kpi-card__label--on-dark">Total revenue</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="kpi-card__value kpi-card__value--revenue">
                <AnimatedMetric
                  value={metrics.totalRevenue}
                  format={(n) => `₵${Math.round(n).toLocaleString()}`}
                />
              </p>
              {hasSparklineVariance(revenueSparkline) && (
                <MiniSparkline values={revenueSparkline!} tone="light" className="h-11 w-32" />
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <p className="kpi-card__subtext kpi-card__subtext--on-dark">
                RevPAR ₵{metrics.reviParMetric.toLocaleString()}
              </p>
              {revenueTrend?.changePercent != null && (
                <TrendBadge value={revenueTrend.changePercent} onDark label="" />
              )}
            </div>
          </div>

          {revenueTrend && (revenueTrend.lastMonth > 0 || revenueTrend.thisMonth > 0) && (
            <div className="grid w-full grid-cols-2 gap-2.5 sm:max-w-[13rem] sm:grid-cols-1">
              <div className="kpi-metric-pill kpi-metric-pill--on-dark">
                <p className="kpi-metric-pill__label">This month</p>
                <p className="kpi-metric-pill__value">₵{revenueTrend.thisMonth.toLocaleString()}</p>
              </div>
              <div className="kpi-metric-pill kpi-metric-pill--on-dark">
                <p className="kpi-metric-pill__label">Last month</p>
                <p className="kpi-metric-pill__value">₵{revenueTrend.lastMonth.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  rawValue,
  formatValue,
  subtext,
  warning,
  sparkline,
  trendUp,
  tone = 'bookings',
}: {
  label: string
  value: string
  rawValue?: number
  formatValue?: (n: number) => string
  subtext: string
  warning?: boolean
  sparkline?: number[]
  trendUp?: boolean
  tone?: 'bookings' | 'balance' | 'rate'
}) {
  const toneClass = warning
    ? 'kpi-card--tile-tone-balance-warn'
    : tone === 'bookings'
      ? 'kpi-card--tile-tone-bookings'
      : tone === 'balance'
        ? 'kpi-card--tile-tone-balance-ok'
        : 'kpi-card--tile-tone-rate'

  const sparklineTone = tone === 'bookings' ? 'primary' : tone === 'balance' && !warning ? 'emerald' : 'slate'

  return (
    <div className={`kpi-card kpi-card--tile kpi-card--tile-elevated kpi-card--tile-compact ${toneClass}`}>
      <p className="kpi-card__label">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <p className="kpi-card__value kpi-card__value--tile-sm">
          {rawValue != null && formatValue ? (
            <AnimatedMetric value={rawValue} format={formatValue} />
          ) : (
            value
          )}
        </p>
        <div className="flex items-center gap-2">
          {trendUp && (
            <span className="inline-flex items-center text-primary/70">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          )}
          {hasSparklineVariance(sparkline) && (
            <MiniSparkline values={sparkline!} tone={sparklineTone} className="h-8 w-[4.5rem]" />
          )}
        </div>
      </div>
      <p className="kpi-card__subtext mt-auto pt-2">{subtext}</p>
    </div>
  )
}

export function KPICards({
  metrics,
  revenueTrend,
  revenueSparkline,
  bookingsSparkline,
  occupancyToday,
  occupancySparkline,
  showRevenue = true,
  compactMetrics = false,
  aside,
  roomsHref = '/owner/rooms',
}: KPICardsProps) {
  if (!metrics) {
    return (
      <DataEmptyState
        icon={BarChart3}
        title="No metrics yet"
        message="Add reservations and room data to see revenue and booking trends here."
      />
    )
  }

  const m = metrics
  const balanceWarning = m.outstandingBalance > 0

  const supportingTiles = (
    <div className={`grid gap-3 ${compactMetrics ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
      {!compactMetrics && (
        <MetricTile
          label="Avg. nightly rate"
          value={`₵${m.averageNightlyRate}`}
          subtext="Average daily rate"
          tone="rate"
        />
      )}
      <MetricTile
        label="Active bookings"
        value={m.totalBookings.toString()}
        rawValue={m.totalBookings}
        formatValue={(n) => Math.round(n).toString()}
        subtext={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'}`}
        sparkline={bookingsSparkline}
        trendUp={m.totalBookings > 0}
        tone="bookings"
      />
      <MetricTile
        label="Unpaid balances"
        value={`₵${m.outstandingBalance.toLocaleString()}`}
        rawValue={m.outstandingBalance}
        formatValue={(n) => `₵${Math.round(n).toLocaleString()}`}
        subtext={
          m.outstandingCount > 0
            ? `${m.outstandingCount} invoice${m.outstandingCount === 1 ? '' : 's'} due`
            : 'All settled'
        }
        warning={balanceWarning}
        tone="balance"
      />
    </div>
  )

  if (!showRevenue) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile
          label="Typical room rate"
          value={`₵${m.averageNightlyRate}`}
          subtext="List price benchmark"
          tone="rate"
        />
        <MetricTile
          label="Active bookings"
          value={m.totalBookings.toString()}
          rawValue={m.totalBookings}
          formatValue={(n) => Math.round(n).toString()}
          subtext={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'} on record`}
          sparkline={bookingsSparkline}
          tone="bookings"
        />
        <MetricTile
          label="Unpaid balances"
          value={`₵${m.outstandingBalance.toLocaleString()}`}
          rawValue={m.outstandingBalance}
          formatValue={(n) => `₵${Math.round(n).toLocaleString()}`}
          subtext={
            m.outstandingCount > 0
              ? `${m.outstandingCount} invoice${m.outstandingCount === 1 ? '' : 's'} awaiting payment`
              : 'All guest balances settled'
          }
          warning={balanceWarning}
          tone="balance"
        />
      </div>
    )
  }

  const main = (
    <div className="space-y-3">
      <div className="dashboard-hero-metrics">
        <RevenueBanner
          metrics={m}
          revenueTrend={revenueTrend}
          revenueSparkline={revenueSparkline}
        />
        <OccupancySnapshot
          occupancy={occupancyToday}
          trend={occupancySparkline}
          roomsHref={roomsHref}
        />
      </div>
      {supportingTiles}
    </div>
  )

  if (!aside) return main

  return (
    <div className="dashboard-bento">
      <div className="dashboard-bento__main">{main}</div>
      <div className="dashboard-bento__aside">{aside}</div>
    </div>
  )
}
