'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, BarChart3, BedDouble, CalendarCheck, Coins } from 'lucide-react'
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

function SimpleKpiCard({
  icon: Icon,
  label,
  value,
  rawValue,
  formatValue,
  trend,
  sparkline,
  warning,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  rawValue?: number
  formatValue?: (n: number) => string
  trend?: number | null
  sparkline?: number[]
  warning?: boolean
  hint?: string
}) {
  return (
    <div className={`kpi-card kpi-card--simple ${warning ? 'kpi-card--simple-warning' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="kpi-card__icon-wrap" aria-hidden>
          <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
        </span>
        {hasSparklineVariance(sparkline) && (
          <MiniSparkline values={sparkline!} tone="gold" className="h-7 w-[4.5rem] opacity-80" />
        )}
      </div>

      <p className="kpi-card__label mt-5">{label}</p>

      <p className="kpi-card__value mt-2">
        {rawValue != null && formatValue ? (
          <AnimatedMetric value={rawValue} format={formatValue} />
        ) : (
          value
        )}
      </p>

      <div className="mt-3 flex min-h-[1.375rem] flex-wrap items-center gap-2">
        {trend != null && <TrendBadge value={trend} label="" />}
        {hint && !trend && <span className="kpi-card__hint">{hint}</span>}
      </div>
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

  const cards = (
    <div
      className={`grid grid-cols-1 gap-4 ${
        showRevenue ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'
      }`}
    >
      {showRevenue && (
        <SimpleKpiCard
          icon={Coins}
          label="Total revenue"
          value={`₵${m.totalRevenue.toLocaleString()}`}
          rawValue={m.totalRevenue}
          formatValue={(n) => `₵${Math.round(n).toLocaleString()}`}
          trend={revenueTrend?.changePercent ?? null}
          sparkline={revenueSparkline}
          hint={`RevPAR ₵${m.reviParMetric.toLocaleString()}`}
        />
      )}
      <SimpleKpiCard
        icon={BedDouble}
        label={showRevenue ? 'Avg. nightly rate' : 'Typical room rate'}
        value={`₵${m.averageNightlyRate}`}
        hint="Per room night"
      />
      <SimpleKpiCard
        icon={CalendarCheck}
        label="Active bookings"
        value={m.totalBookings.toString()}
        rawValue={m.totalBookings}
        formatValue={(n) => Math.round(n).toString()}
        sparkline={bookingsSparkline}
        hint={`${m.totalGuests} guest${m.totalGuests === 1 ? '' : 's'}`}
      />
      <SimpleKpiCard
        icon={AlertCircle}
        label="Unpaid balances"
        value={`₵${m.outstandingBalance.toLocaleString()}`}
        rawValue={m.outstandingBalance}
        formatValue={(n) => `₵${Math.round(n).toLocaleString()}`}
        warning={balanceWarning}
        hint={
          m.outstandingCount > 0
            ? `${m.outstandingCount} invoice${m.outstandingCount === 1 ? '' : 's'} open`
            : 'All settled'
        }
      />
    </div>
  )

  if (!aside) return cards

  return (
    <div className="dashboard-bento">
      <div className="dashboard-bento__main">{cards}</div>
      <div className="dashboard-bento__aside">{aside}</div>
    </div>
  )
}
