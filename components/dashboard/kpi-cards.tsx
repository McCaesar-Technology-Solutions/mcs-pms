'use client'

import type { ReactNode } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import { AnimatedMetric } from '@/components/dashboard/animated-metric'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import { TrendBadge } from '@/components/dashboard/trend-badge'
import type { RevenueTrend } from '@/lib/data/overview'
import type { KPIMetrics } from '@/types'

interface KPICardsProps {
  metrics?: KPIMetrics
  revenueTrend?: RevenueTrend
  revenueSparkline?: number[]
  bookingsSparkline?: number[]
  showRevenue?: boolean
  aside?: ReactNode
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
                RevPAR ₵{metrics.reviParMetric.toLocaleString()} per room
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
}: {
  label: string
  value: string
  rawValue?: number
  formatValue?: (n: number) => string
  subtext: string
  warning?: boolean
  sparkline?: number[]
  trendUp?: boolean
}) {
  return (
    <div className={`kpi-card kpi-card--tile kpi-card--tile-elevated ${warning ? 'kpi-card--tile-warning' : ''}`}>
      <p className="kpi-card__label">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="kpi-card__value kpi-card__value--tile">
          {rawValue != null && formatValue ? (
            <AnimatedMetric value={rawValue} format={formatValue} />
          ) : (
            value
          )}
        </p>
        <div className="flex items-center gap-2">
          {trendUp && (
            <span className="inline-flex items-center text-[var(--comp-teal)]">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          )}
          {hasSparklineVariance(sparkline) && (
            <MiniSparkline values={sparkline!} tone="slate" className="h-9 w-[5.5rem]" />
          )}
        </div>
      </div>
      <p className="kpi-card__subtext mt-auto pt-4">{subtext}</p>
    </div>
  )
}

export function KPICards({
  metrics,
  revenueTrend,
  revenueSparkline,
  bookingsSparkline,
  showRevenue = true,
  aside,
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

  const tiles = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricTile
        label="Avg. nightly rate"
        value={`₵${m.averageNightlyRate}`}
        subtext="Average daily rate"
      />
      <MetricTile
        label="Active bookings"
        value={m.totalBookings.toString()}
        rawValue={m.totalBookings}
        formatValue={(n) => Math.round(n).toString()}
        subtext={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'} on record`}
        sparkline={bookingsSparkline}
        trendUp={m.totalBookings > 0}
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
        />
        <MetricTile
          label="Active bookings"
          value={m.totalBookings.toString()}
          rawValue={m.totalBookings}
          formatValue={(n) => Math.round(n).toString()}
          subtext={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'} on record`}
          sparkline={bookingsSparkline}
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
        />
      </div>
    )
  }

  const main = (
    <div className="space-y-3.5">
      <RevenueBanner
        metrics={m}
        revenueTrend={revenueTrend}
        revenueSparkline={revenueSparkline}
      />
      {tiles}
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
