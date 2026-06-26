'use client'

import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Banknote,
  Percent,
  Users,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  RevenueAreaChart,
  WeeklyActivityChart,
  WeeklyRevenueBars,
  ChannelDonutChart,
  RingGauge,
  StarRatingVisual,
} from '@/components/dashboard/analytics-charts'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { AnalyticsData } from '@/lib/data/analytics'

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function growthLabel(value: number | null): { text: string; positive: boolean | null } {
  if (value === null) return { text: '—', positive: null }
  return { text: `${value >= 0 ? '+' : ''}${value}%`, positive: value >= 0 }
}

function MoMCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string
  value: string
  sublabel: string
  accent: 'emerald' | 'blue' | 'amber' | 'purple'
}) {
  const accents = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    purple: 'from-[#3C216C]/15 to-[#3C216C]/5 border-[#3C216C]/20',
  }
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 ${accents[accent]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
    </div>
  )
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  if (data.totalBookings === 0 && data.totalRevenue === 0) {
    return (
      <DataEmptyState message="Add reservations and check out guests to populate analytics." />
    )
  }

  const revGrowth = growthLabel(data.revenueGrowthPct)
  const bookGrowth = growthLabel(data.bookingGrowthPct)

  const primaryKpis = [
    {
      label: 'Total revenue',
      value: money(data.totalRevenue),
      sub: `RevPAR ${money(data.revPar)}`,
      icon: Banknote,
      tint: 'bg-[#3C216C]/10',
      iconBg: 'bg-[#3C216C]/15 text-[#3C216C] ring-[#3C216C]/20',
    },
    {
      label: 'Occupancy',
      value: `${Math.round(data.occupancyRate * 100)}%`,
      sub: 'rooms occupied now',
      icon: Percent,
      tint: 'bg-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-700 ring-blue-500/20',
    },
    {
      label: 'Avg nightly rate',
      value: money(data.averageNightlyRate),
      sub: 'per room night sold',
      icon: BarChart3,
      tint: 'bg-emerald-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/20',
    },
    {
      label: 'Total bookings',
      value: String(data.totalBookings),
      sub: `${data.totalGuests} unique guests`,
      icon: Users,
      tint: 'bg-[#D4A62E]/10',
      iconBg: 'bg-[#D4A62E]/15 text-[#B88D24] ring-[#D4A62E]/25',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero — revenue spotlight + MoM snapshot */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="kpi-card xl:col-span-7">
          <div className="absolute inset-0 bg-gradient-to-br from-[#3C216C]/12 via-[#3C216C]/5 to-[#D4A62E]/10" />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Total revenue
                </p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {money(data.totalRevenue)}
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  RevPAR {money(data.revPar)} · {data.totalBookings} bookings
                </p>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  revGrowth.positive === null
                    ? 'bg-secondary text-muted-foreground'
                    : revGrowth.positive
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-red-500/15 text-red-600'
                }`}
              >
                {revGrowth.positive === null ? (
                  <Minus className="h-4 w-4" />
                ) : revGrowth.positive ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {revGrowth.text} this month
              </div>
            </div>
            <div className="mt-6 -mx-2">
              <RevenueAreaChart data={data.monthly} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:col-span-5">
          <MoMCard
            label="Revenue MoM"
            value={revGrowth.text}
            sublabel="vs last month"
            accent="purple"
          />
          <MoMCard
            label="Bookings MoM"
            value={bookGrowth.text}
            sublabel="vs last month"
            accent="blue"
          />
          <MoMCard
            label="Cancellations"
            value={`${data.cancellationRatePct}%`}
            sublabel="of all reservations"
            accent="amber"
          />
          <MoMCard
            label="Peak check-in"
            value={data.peakDay ?? '—'}
            sublabel="busiest day of week"
            accent="emerald"
          />
        </div>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {primaryKpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="kpi-card group">
              <div className={`absolute inset-0 ${kpi.tint}`} />
              <div className="relative z-10 p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 ring-1 ${kpi.iconBg}`}>
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                </div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Full revenue trend */}
      <div className="surface-card overflow-hidden p-6 sm:p-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Revenue trend</h3>
            <p className="text-sm text-muted-foreground">Last 6 months by check-in date</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-6 rounded-full bg-gradient-to-r from-[#3C216C] to-[#D4A62E]" />
              Revenue
            </span>
          </div>
        </div>
        <RevenueAreaChart data={data.monthly} />
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {data.monthly.map((m) => (
            <div
              key={m.month}
              className="rounded-xl bg-secondary/60 px-3 py-2 text-center"
            >
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                {m.month.split(' ')[0]}
              </p>
              <p className="mt-0.5 text-sm font-bold text-foreground">
                {m.revenue > 0 ? money(m.revenue) : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">{m.bookings} bk</p>
            </div>
          ))}
        </div>
      </div>

      {/* Last 7 days — visual charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="surface-card p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Check-ins</h3>
              <p className="text-sm text-muted-foreground">Last 7 days — new arrivals</p>
            </div>
            <div className="rounded-xl bg-[#3C216C]/10 p-2.5 text-[#3C216C]">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <WeeklyActivityChart data={data.weekly} />
        </div>

        <div className="surface-card p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Daily revenue</h3>
              <p className="text-sm text-muted-foreground">Booking value on check-in day</p>
            </div>
            <div className="rounded-xl bg-[#D4A62E]/15 p-2.5 text-[#B88D24]">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <WeeklyRevenueBars data={data.weekly} />
        </div>
      </div>

      {/* Ring gauges + channel donut */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="surface-card p-6 sm:p-8 xl:col-span-5">
          <h3 className="text-lg font-semibold text-foreground">Health at a glance</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Occupancy, billing, and guest satisfaction
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-2">
            <RingGauge
              value={Math.round(data.occupancyRate * 100)}
              label="Occupancy"
              sublabel="rooms in use"
              color="#3C216C"
            />
            <RingGauge
              value={data.collectionRatePct ?? 0}
              label="Collection"
              sublabel="invoices paid"
              color="#059669"
            />
            <RingGauge
              value={data.repeatRatePct}
              label="Repeat guests"
              sublabel="returned 2+ times"
              color="#D4A62E"
            />
            <RingGauge
              value={100 - data.cancellationRatePct}
              label="Retention"
              sublabel="non-cancelled"
              color="#2563EB"
            />
          </div>
          <div className="mt-8 rounded-2xl bg-secondary/50 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avg stay · {data.avgStayNights} nights
            </p>
            {data.avgGuestRating != null ? (
              <>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.avgGuestRating}</p>
                <StarRatingVisual rating={data.avgGuestRating} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.feedbackCount} guest review{data.feedbackCount !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No guest reviews yet</p>
            )}
          </div>
        </div>

        <div className="surface-card p-6 sm:p-8 xl:col-span-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Booking channels</h3>
              <p className="text-sm text-muted-foreground">Revenue mix by source</p>
            </div>
            {bookGrowth.positive !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  bookGrowth.positive
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-red-500/15 text-red-600'
                }`}
              >
                {bookGrowth.positive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {bookGrowth.text} bookings
              </span>
            )}
          </div>
          <ChannelDonutChart channels={data.channels} />
        </div>
      </div>
    </div>
  )
}
