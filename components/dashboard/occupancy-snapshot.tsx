'use client'

import Link from 'next/link'
import { ChevronRight, Percent } from 'lucide-react'
import type { OccupancyToday } from '@/lib/data/occupancy'

interface OccupancySnapshotProps {
  occupancy?: OccupancyToday
  trend?: number[]
  roomsHref?: string
}

function trendCaption(values: number[], todayPercent?: number): string | null {
  if (values.length === 0) return null

  const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)

  if (todayPercent == null) {
    return `14-day average ${avg}%`
  }

  const diff = todayPercent - avg
  if (diff === 0) {
    return `14-day average ${avg}% · in line with today`
  }

  const direction = diff > 0 ? 'above' : 'below'
  return `14-day average ${avg}% · ${Math.abs(diff)} pts ${direction} average`
}

export function OccupancySnapshot({
  occupancy,
  trend = [],
  roomsHref = '/owner/rooms',
}: OccupancySnapshotProps) {
  const trendLabel = trend.length > 0 ? trendCaption(trend, occupancy?.percent) : null

  return (
    <div className="kpi-card kpi-card--occupancy-hero">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kpi-card__label">Occupancy today</p>
            <p className="kpi-card__value kpi-card__value--occupancy mt-2">
              {occupancy ? `${occupancy.percent}%` : '—'}
            </p>
            {occupancy && (
              <p className="kpi-card__subtext mt-2">
                {occupancy.occupied} of {occupancy.total} rooms in use
              </p>
            )}
          </div>
          <div className="occupancy-hero__icon" aria-hidden>
            <Percent className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>

        {occupancy && (
          <div className="occupancy-hero__track mt-4">
            <div
              className="occupancy-hero__fill"
              style={{ width: `${Math.min(100, Math.max(0, occupancy.percent))}%` }}
            />
          </div>
        )}

        {trendLabel && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{trendLabel}</p>
        )}

        <Link
          href={roomsHref}
          className="occupancy-hero__link mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Room board
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
