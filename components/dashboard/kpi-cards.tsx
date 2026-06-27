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
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="kpi-card__label">Total revenue</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-[2.35rem] font-bold tabular-nums leading-none tracking-tight text-[var(--brand-gold-light)] sm:text-[2.85rem]">
                <AnimatedMetric
                  value={metrics.totalRevenue}
                  format={(n) => `₵${Math.round(n).toLocaleString()}`}
                />
              </p>
              {hasSparklineVariance(revenueSparkline) && (
                <MiniSparkline values={revenueSparkline!} tone="light" className="h-10 w-28" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-sm text-white/55">
                RevPAR ₵{metrics.reviParMetric.toLocaleString()} per room
              </p>
              {revenueTrend?.changePercent != null && (
                <TrendBadge value={revenueTrend.changePercent} onDark label="" />
              )}
            </div>
          </div>

          {revenueTrend && (revenueTrend.lastMonth > 0 || revenueTrend.thisMonth > 0) && (
            <div className="grid w-full grid-cols-2 gap-2 sm:max-w-xs sm:grid-cols-1">
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
  accent,
}: {
  label: string
  value: string
  rawValue?: number
  formatValue?: (n: number) => string
  subtext: string
  warning?: boolean
  sparkline?: number[]
  trendUp?: boolean
  accent?: 'slate' | 'teal'
}) {
  const accentClass = warning
    ? 'kpi-card--tile-warning'
    : accent === 'teal'
      ? 'kpi-card--tile-accent-teal'
      : accent === 'slate'
        ? 'kpi-card--tile-accent-slate'
        : ''

  return (
    <div className={`kpi-card kpi-card--tile ${accentClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="kpi-card__label">{label}</p>
        {trendUp && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
            <TrendingUp className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="kpi-card__value">
          {rawValue != null && formatValue ? (
            <AnimatedMetric value={rawValue} format={formatValue} />
          ) : (
            value
          )}
        </p>
        {hasSparklineVariance(sparkline) && (
          <MiniSparkline
            values={sparkline!}
            tone={accent === 'teal' ? 'teal' : 'slate'}
            className="h-8 w-20"
          />
        )}
      </div>
      <p className="kpi-card__subtext mt-auto pt-3">{subtext}</p>
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
        accent="slate"
      />
      <MetricTile
        label="Active bookings"
        value={m.totalBookings.toString()}
        rawValue={m.totalBookings}
        formatValue={(n) => Math.round(n).toString()}
        subtext={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'} on record`}
        sparkline={bookingsSparkline}
        trendUp={m.totalBookings > 0}
        accent="teal"
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
          accent="slate"
        />
        <MetricTile
          label="Active bookings"
          value={m.totalBookings.toString()}
          rawValue={m.totalBookings}
          formatValue={(n) => Math.round(n).toString()}
          subtext={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'} on record`}
          sparkline={bookingsSparkline}
          accent="teal"
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
    <div className="space-y-3">
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
