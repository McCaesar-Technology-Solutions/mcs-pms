'use client'

import type { AnalyticsMonthlyPoint, AnalyticsWeeklyPoint } from '@/lib/data/analytics'
import type { ChannelPerf } from '@/lib/data/overview'
import type { Reservation } from '@/types'

const CHANNEL_COLORS: Record<Reservation['source'], string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  walk_in: '#D4A62E',
  website: '#3C216C',
  other: '#94A3B8',
}

const CHANNEL_LABEL: Record<Reservation['source'], string> = {
  website: 'Direct',
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  walk_in: 'Walk-in',
  other: 'Other',
}

function formatMoneyShort(value: number) {
  if (value >= 1000) return `₵${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `₵${value}`
}

/** Smooth area + line chart for monthly revenue. */
export function RevenueAreaChart({ data }: { data: AnalyticsMonthlyPoint[] }) {
  const width = 640
  const height = 220
  const pad = { top: 28, right: 16, bottom: 44, left: 52 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(1, ...data.map((d) => d.revenue))
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW

  const points = data.map((d, i) => ({
    x: pad.left + i * step,
    y: pad.top + innerH - (d.revenue / max) * innerH,
    revenue: d.revenue,
    label: d.month,
    bookings: d.bookings,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? pad.left} ${pad.top + innerH} L ${points[0]?.x ?? pad.left} ${pad.top + innerH} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.top + innerH * (1 - t),
    label: formatMoneyShort(max * t),
  }))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Six month revenue trend"
      >
        <defs>
          <linearGradient id="revenueAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3C216C" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3C216C" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="revenueLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3C216C" />
            <stop offset="100%" stopColor="#D4A62E" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => (
          <g key={g.y}>
            <line
              x1={pad.left}
              y1={g.y}
              x2={width - pad.right}
              y2={g.y}
              stroke="#E9ECEF"
              strokeDasharray="4 4"
            />
            <text x={pad.left - 8} y={g.y + 4} textAnchor="end" className="fill-[#5E5872] text-[10px]">
              {g.label}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#revenueAreaGrad)" />
        <path d={linePath} fill="none" stroke="url(#revenueLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#3C216C" strokeWidth="2.5" />
            <title>{`${p.label}: ${formatMoneyShort(p.revenue)} (${p.bookings} bookings)`}</title>
            <text
              x={p.x}
              y={height - 14}
              textAnchor="middle"
              className="fill-[#5E5872] text-[10px] font-semibold"
            >
              {p.label.split(' ')[0]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Grouped bar chart — bookings + revenue scale for last 7 days. */
export function WeeklyActivityChart({ data }: { data: AnalyticsWeeklyPoint[] }) {
  const width = 640
  const height = 240
  const pad = { top: 20, right: 16, bottom: 52, left: 16 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxBookings = Math.max(1, ...data.map((d) => d.bookings))
  const barGroupW = innerW / data.length
  const barW = Math.min(28, barGroupW * 0.45)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[320px]" role="img" aria-label="Weekly check-ins">
        <line
          x1={pad.left}
          y1={pad.top + innerH}
          x2={width - pad.right}
          y2={pad.top + innerH}
          stroke="#E9ECEF"
          strokeWidth="2"
        />

        {data.map((day, i) => {
          const cx = pad.left + i * barGroupW + barGroupW / 2
          const barH = (day.bookings / maxBookings) * innerH
          const y = pad.top + innerH - barH
          const isPeak = day.bookings === maxBookings && day.bookings > 0

          return (
            <g key={day.date}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(barH, day.bookings > 0 ? 6 : 0)}
                rx={6}
                fill={isPeak ? '#D4A62E' : '#3C216C'}
                opacity={day.bookings > 0 ? 1 : 0.15}
              />
              {day.bookings > 0 && (
                <text x={cx} y={y - 6} textAnchor="middle" className="fill-[#3C216C] text-[11px] font-bold">
                  {day.bookings}
                </text>
              )}
              <text x={cx} y={height - 28} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                {day.day}
              </text>
              <text x={cx} y={height - 12} textAnchor="middle" className="fill-[#5E5872] text-[9px]">
                {day.date}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Donut chart for booking channel mix. */
export function ChannelDonutChart({ channels }: { channels: ChannelPerf[] }) {
  const total = channels.reduce((s, c) => s + c.revenue, 0)
  if (total <= 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No channel data yet
      </div>
    )
  }

  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 72
  const stroke = 28
  const circ = 2 * Math.PI * r
  let offset = 0

  const segments = channels.map((ch) => {
    const pct = ch.revenue / total
    const dash = pct * circ
    const seg = {
      ...ch,
      pct,
      dash,
      offset,
      color: CHANNEL_COLORS[ch.channel] ?? '#94A3B8',
      label: CHANNEL_LABEL[ch.channel] ?? ch.channel,
    }
    offset += dash
    return seg
  })

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F3F5" strokeWidth={stroke} />
        {segments.map((seg) => (
          <circle
            key={seg.channel}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
            strokeDashoffset={-seg.offset + circ / 4}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-[22px] font-bold">
          {channels.length}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[#5E5872] text-[11px]">
          channels
        </text>
      </svg>

      <ul className="w-full max-w-xs space-y-3">
        {segments.map((seg) => (
          <li key={seg.channel} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{seg.label}</span>
                <span className="text-sm font-bold text-foreground">{Math.round(seg.pct * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }}
                />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {seg.bookings} bookings · ₵{seg.revenue.toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Circular progress ring for percentages. */
export function RingGauge({
  value,
  max = 100,
  label,
  sublabel,
  color = '#3C216C',
  size = 100,
}: {
  value: number
  max?: number
  label: string
  sublabel?: string
  color?: string
  size?: number
}) {
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, value / max))
  const dash = pct * circ

  return (
    <div className="flex flex-col items-center text-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E9ECEF"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          className="fill-foreground text-lg font-bold"
        >
          {max === 100 ? `${Math.round(value)}%` : value}
        </text>
      </svg>
      <p className="mt-2 text-sm font-semibold text-foreground">{label}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  )
}

/** Horizontal revenue bars for the week — gradient fills. */
export function WeeklyRevenueBars({ data }: { data: AnalyticsWeeklyPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue))

  return (
    <div className="space-y-4">
      {data.map((day) => {
        const pct = (day.revenue / max) * 100
        return (
          <div key={day.date}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {day.day}{' '}
                <span className="font-normal text-muted-foreground">{day.date}</span>
              </span>
              <span className="font-bold tabular-nums text-[#3C216C]">
                ₵{day.revenue.toLocaleString()}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#F1F3F5]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3C216C] to-[#D4A62E] transition-all duration-500"
                style={{ width: `${Math.max(pct, day.revenue > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StarRatingVisual({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={i < Math.round(rating) ? '#D4A62E' : '#E9ECEF'}
          />
        </svg>
      ))}
    </div>
  )
}
